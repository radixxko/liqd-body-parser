const http = require('http');
const fs = require('fs');

const server = http.createServer(( req, res ) =>
{
    if( req.url.startsWith( '/form.html' ))
    {
        res.setHeader( 'Content-Type', 'text/html' );
        res.end( fs.readFileSync( __dirname + '/upload/form.html' ));
    }
    else if( req.url.startsWith( '/javascript.html' ))
    {
        res.setHeader( 'Content-Type', 'text/html' );
        res.end( fs.readFileSync( __dirname + '/upload/javascript.html' ));
    }
    else if( req.url.startsWith( '/uploader.js' ))
    {
        res.setHeader( 'Content-Type', 'text/javascript' );
        res.end( fs.readFileSync( __dirname + '/upload/uploader.js' ));
    }
    else if( req.url.startsWith( '/upload' ))
    {
        console.log( 'upload' );
    }
});

server.listen( 8080 );
