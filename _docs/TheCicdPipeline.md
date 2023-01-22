# The Deployment Pipeline

In this project, deployment follows CICD practices. This means automated testing runs, and if tests pass _then_ a deployment happens.

This is made possible by a combination of GitHub Actions and Google Cloud Platform, explored in detail below.


## Continuous Integration

This document won't dig through every little bit of the CI file, but the CI file itself is heavily commented for reading. Dig through this file:

[./.github/workflows/ci.yml](./.github/workflows/ci.yml)

We'll expand on some of the bigger, more-important or more-complex parts here.

So, that is a GitHub Actions workflow file. If you're not familiar with what that is, it's basically a script of things that GitHub can perform. 


### Automation trigger 

For the sake of education, the workflow is manually triggered. That's what the line with `on: workflow_dispatch` is doing.

In a real, professional project, the workflow should be triggered either on pull request, on commit, or both. This is typically handy with complex team git workflows that involve branching. At its most basic, that trigger will look like:

```yml
on: 
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]
```

### Test databases

For an API server, testing typically involves database functionality. Using a real, cloud-hosted database for the sake of testing would cost precious dollars from the cloud budget. Luckily, there are GitHub Actions that we can insert into our workflow files that install a database locally.

This project uses Supercharge's "MongoDB In GitHub Actions" action as found here: [https://github.com/supercharge/mongodb-github-action](https://github.com/supercharge/mongodb-github-action)

This may make the CI action itself run for a bit longer, but it functions the same as a development/local database when it comes to speed and data storage - all while avoiding the cost of having an additional database set up in a cloud platform purely for testing.


### The actual testing

The trick with GitHub Actions is that your actions should not actually do much. This is reflected strongest in the part of the CI action that actually runs the tests - the workflow file just calls the NPM custom script configured in the project's `package.json` file.

```yml
    - name: Run tests
      run: npm run test-ci
      env:
        CI: true
```

So, the project's `test-ci` command already uses the `--ci` flag within it. The action workflow sets an environment variable for `CI` too. This is because that while Jest is using the `--ci` flag, things that aren't Jest don't know about that flag. There might be some NPM package somewhere in the project's dependencies that reads the environment variable `CI` and respects that, but cannot read the Jest flag. For the sake of making sure that any code running in this action is as sure as possible that this is in a CI environment, we set this `CI` value to true.


### When tests are done

GitHub Actions has a clever little system where workflow jobs and workflow job steps are able to depend on other jobs or steps. You can read the GitHub documentation about this here: [https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_idneeds](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_idneeds)

In this project, we want deployment to happen _only if tests pass_. The `needs` keyword in a job or step configuration allows to specify the ID of other jobs or steps that must finish successfully. If a test fails, the test job/step does not finish successfully. Pretty easy logic, right?

```
if job1 succeeds
	run job2
else
	do nothing
endif 
```

In GitHub actions, the ID of a jobs and steps are declared like so:

```yml
name: Example workflow name
on: push
jobs:

	example_job_id:
		name: Example Job Name
		runs-on: ubuntu-latest
		steps:
			- id: example_step_id
			  run: echo "hello world"

	another_example_job:
		needs: example_job_id
		name: Job 2
		steps:
			- id: some_other_step_id
			  run: echo "hello world again!"
```

The `ci.yml` file of this project takes this a step further, and uses that job dependency to trigger the `cd.yml` workflow. This is where the gate in the logic happens: if the testing job fails, the deployment job never even activates.

When calling a workflow file from another workflow file, data such as secrets must be passed along. This is because secrets are contextual and isolated - a security measure to prevent misuse of data. To work around that, we simply say `secrets: inherit` to say that the called workflow can access all secrets from the caller workflow.

```yml
call_cicd_workflow:
    needs: run_server_tests
    name: Call the CD workflow
    uses: ./.github/workflows/cd.yml
    with:
      example_data_passed_along: Example string
    secrets: inherit
```


## Continuous Deployment

Similar to above, this document won't dig through every little bit of the CD file, but the CD file itself is heavily commented for reading. Dig through this file:

[./.github/workflows/cd.yml](./.github/workflows/cd.yml)

We'll expand on some of the bigger, more-important or more-complex parts here. 

### The goal

The deployment pipeline here is straightforward:

1. Bundle up the project into a Docker file
2. Send the Docker file to a Docker image registry, ideally a private registry so that no one else can spin up copies of our API.
3. Tell a cloud deployment platform to serve our latest Docker image to a specific domain name.

The only technology mentioned there is Docker - doesn't matter what your app is or which cloud platform you choose to use. 

This means that a good deployment workflow will be reusable across a variety of projects. A web server written in JavaScript will be deployed as easily as a web server written in Python, C#, Go, Java, whatever - doesn't matter. Get that stuff into a Docker file and the steps to deploy will become pretty standardized.

### Turn your project into a Docker image

This is either very easy or extremely easy, depending on your deployment platform of choice. 

I say this because the old version of this project's deployment workflow looked like this:

```yml
name: CICD

on: 
  workflow_call:
    inputs:
      caller_sha:
        required: true
        type: string

env:
  PROJECT_ID: ${{ secrets.GKE_PROJECT }}
  IMAGE: blahblahblah-image

jobs:
  setup-build-publish-deploy:
    name: Build & Deploy
    runs-on: ubuntu-latest

    steps:
    - name: Checkout
      uses: actions/checkout@v3

    # Setup gcloud CLI
    - name: Set up gcloud Cloud SDK environment
      uses: google-github-actions/setup-gcloud@v0.6.0
      with:
        service_account_key: ${{ secrets.GKE_SA_KEY }} 
        credentials_json: '${{ secrets.GCP_CREDENTIALS }}'
        project_id: ${{ secrets.GKE_PROJECT }}

    # Configure Docker to use the gcloud command-line tool 
	# as a credential helper for authentication
    - run: |-
        gcloud --quiet auth configure-docker
    # Build the Docker image
    - name: Build
      run: |-
        docker build \
          --tag "gcr.io/$PROJECT_ID/$IMAGE:${{inputs.caller_sha}}" \
          --build-arg GITHUB_SHA="${{inputs.caller_sha}}" \
          --build-arg GITHUB_REF="$GITHUB_REF" \
          .
    # Push the Docker image to Google Container Registry
    - name: Publish
      run: |-
        docker push "gcr.io/$PROJECT_ID/$IMAGE:${{inputs.caller_sha}}"
    - name: Push to Cloud run
      run: |-
        gcloud run deploy blahblahblah --image gcr.io/$PROJECT_ID/$IMAGE:${{inputs.caller_sha}} --platform managed --region us-central1
```

That workflow explicitly uses the Docker command line tools to build an image, deploy it to a specified private registry, and then tell Google Cloud to use that privately-registered Docker image to respond to web traffic on a configured domain name. In theory, that same logic will work on the other big cloud platforms too.

The code might look freaky, but a lot of that is "read the git information and use it to make commit-specific tags on the Docker images so you can easily keep track of which Docker image is using which version of the project".

However, the new version is even simpler.

```yml
name: Deploy the project

on: 
  workflow_call:
    inputs:
      example_data_passed_along:
        required: true
        type: string

jobs:
  setup-build-publish-deploy:
    name: Build & Deploy
    runs-on: ubuntu-latest

    steps:
    - name: Checkout
      uses: actions/checkout@v3

    - name: Authenticate gcloud
      uses: google-github-actions/auth@v1
      with:
        credentials_json: '${{ secrets.GCP_CREDENTIALS }}'

    - id: 'deploy'
      name: 'Build and deploy image to GCR'
      uses: 'google-github-actions/deploy-cloudrun@v1'
      with:
          service: ${{ secrets.GCR_SERVICE_NAME }}
          region: ${{ secrets.GCR_SERVICE_REGION }}
          source: ./
```

The idea with the newer version of the Google Cloud deployment is that Google Cloud is smart enough to know that any given project _should_ be turned into a Docker file. The action is smart enough to work with Docker images if you wanted to do the old way anyway, or build a more-complex Docker image with a specific, customized Docker file, but for a simple project like this - this is all fine using the source code directly.

The configuration needed in Google Cloud should be covered by the documentation over on the Google-related Github Actions, and will stay up to date more over there than in this lil hobby project.

- Google Cloud authentication: [https://github.com/google-github-actions/auth](https://github.com/google-github-actions/auth)
- "Deploy to Cloud Run" image vs source code input explanation: [https://github.com/google-github-actions/deploy-cloudrun#inputs](https://github.com/google-github-actions/deploy-cloudrun#inputs)
- Google Cloud Run dashboard page, configuration is needed so that the action has something to deploy to: https://console.cloud.google.com/run 

You'll notice that the `cd.yml` file has other code such as environment variables, not shown in the snippets above on this page - make sure you read the code in this project! 