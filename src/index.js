var {app, PORT, HOST} = require('./server');

const server = app.listen(PORT, HOST, () => {
    // If PORT was set to 0, the server will randomly  
    // assign itself an available port number instead.
    // This means that PORT and server.address().port won't match.
    // So, assign PORT that new value or just use 
    // server.address().port in any code when logging.
    if (server.address().port != PORT){
        PORT = server.address().port;
    }

	console.log(`	
	ExpressJS auth API app running! 

    Server mapping is:
	HOST: ${HOST}
	PORT: ${PORT}

	Congrats!
	`);
})