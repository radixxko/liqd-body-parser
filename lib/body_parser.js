'use strict';

const EventEmitter = require('events');
const MultiBuffer = require('liqd-multibuffer');

const canBeHeaderRE = /^[\x21\x23-\x27\x2a-\x2b\x2d-\x2e\x30-\x39\x41-\x5a\x5e-\x7a\x7c\x7e-\x7f]+(:.*)*$/;
const headerRE = /^([\x21\x23-\x27\x2a-\x2b\x2d-\x2e\x30-\x39\x41-\x5a\x5e-\x7a\x7c\x7e-\x7f]+):\s*/;
const headerContinuationRE = /^[\t ]+/;
const encodedWordRE = /=\?([^?]+)\?(Q|B)\?([^?]+)\?=/gi;
const encodedWordHexRE = /=([0-9a-fA-F]{2})/g;
const boundaryRE = /;\s*boundary=("(([^\\"]|\\.)+?)"|[^\s;]+)/;
const boundaryEnd = Buffer.from( '--', 'utf8' );
const delimiter = Buffer.from( '\r\n', 'utf8' );
const spaces = [ 9, 32 ];

//TODO pridat zlepsovat ze hladame az newline a tam splitneme do subbuffra

const Parsing = { HEADER: 0, PREAMBLE: 1, BODY: 2, EPILOGUE: 3 };
const Empty = ( obj ) => { if( obj !== null && obj.length !== 0 ){ for( let key in obj ){ return false }} return true }
const DecodeWords = ( value ) => value.replace( encodedWordRE, ( match, _, type, encoded, encoding ) =>
{
    return type === 'B'
        ? Buffer.from( encoded, 'base64' ).toString('utf-8')
        : encoded.replace( encodedWordHexRE, ( _ , code ) => String.fromCharCode( parseInt( code, 16 )));
});

const Body = module.exports = class Body extends EventEmitter
{
    constructor( headers = {} )
    {
        super();

		this._headers = headers;
        this._status = Empty( headers ) ? Parsing.HEADER : Parsing.PREAMBLE;
        this._buffer = new MultiBuffer();
        this._last_header = null;
        this._boundary = null;
        this._body = null;
        this._last_body = null;
        this._decoded = false;
    }

	_parse( chunk, encoding, callback, end = false )
	{
		if( typeof encoding === 'function' ){[ encoding, callback ] = [ undefined, encoding ]; }
        else if( typeof chunk === 'function' ){[ chunk, encoding, callback ] = [ undefined, undefined, chunk ]; }

        if( chunk && chunk.length && this._status !== Parsing.EPILOGUE )
        {
    		this._buffer.append( chunk );

    		if( this._status === Parsing.HEADER )
    		{
    			let endline;

    			while( ~( endline = this._buffer.indexOf( delimiter )))
    			{
    				let header, line = this._buffer.spliceConcat( 0, endline ).toString('utf8'); this._buffer.splice( 0, delimiter.length );

    				if( !line.length )
    				{
    					this._status = Parsing.PREAMBLE; break;
    				}
    				else if( header = line.match( headerRE ))
    				{
                        this._headers[ this._last_header = header[1].toLowerCase() ] = DecodeWords( line.substr( header[0].length ));
    				}
    				else if( header = line.match( headerContinuationRE ))
    				{
    					this._headers[ this._last_header ] += ' ' + DecodeWords( line.substr( header[0].length ));
    				}
    			}
    		}

            if( this._status === Parsing.PREAMBLE )
            {
                if( !this._boundary && this._headers.hasOwnProperty( 'content-type' ) && ( this._boundary = this._headers['content-type'].match( boundaryRE )))
                {
                    this._boundary = Buffer.from( '--' + ( this._boundary[2] || this._boundary[1] ), 'utf8' );
                }

                if( this._boundary )
                {
                    let boundary;

                    while( this._buffer.length >= this._boundary.length )
                    {
                        if( ~( boundary = this._buffer.indexOf( this._boundary )) && this._buffer.equals( delimiter, boundary + this._boundary.length ))
                        {
                            this._buffer.splice( 0, boundary + this._boundary.length + delimiter.length );
                            this._boundary = Buffer.concat([ delimiter, this._boundary ]);

                            this._status = Parsing.BODY; break;
                        }
                        else
                        {
                            this._buffer.splice( 0, -( this._boundary.length + delimiter.length - 1 ));
                        }
                    }
                }
                else{ this._status = Parsing.BODY; }
            }

    		if( this._status === Parsing.BODY )
    		{
                if( this._boundary )
    			{
                    if( !this._body )
                    {
                        this._body = [ this._last_body = new Body() ];
                    }

                    let boundary;

    				while( this._buffer.length >= this._boundary.length + delimiter.length )
    				{
                        if( ~( boundary = this._buffer.indexOf( this._boundary )))
                        {
                            if( this._buffer.equals( delimiter, boundary + this._boundary.length ))
                            {
                                this._buffer.splice( 0, boundary ).forEach( b => this._last_body.write( b ));
                                this._last_body.end();

                                this._body.push( this._last_body = new Body() );

                                this._buffer.splice( 0, this._boundary.length + delimiter.length );
                            }
                            else if( this._buffer.equals( boundaryEnd, boundary + this._boundary.length ))
                            {
                                this._buffer.splice( 0, boundary ).forEach( b => this._last_body.write( b ));
                                this._last_body.end();

                                this._buffer.clear();

                                this._status = Parsing.EPILOGUE; break;
                            }
                            else
                            {
                                this._buffer.splice( 0, -( this._boundary.length + delimiter.length - 1 )).forEach( b => this._last_body.write( b ));
                            }
                        }
                        else
                        {
                            this._buffer.splice( 0, -( this._boundary.length + delimiter.length - 1 )).forEach( b => this._last_body.write( b ));
                        }
    				}
    			}
                else if( !this._body )
                {
                    this._body = this._buffer;
                }
    		}
        }

		if( end )
		{
			//console.log( this.body() );
		}
	}

    write( chunk, encoding, callback )
    {
        this._parse( chunk, encoding, callback );
    }

    end( chunk, encoding, callback )
    {
        this._parse( chunk, encoding, callback, true );

        //console.log( this._buffer.spliceConcat().toString('utf8') );
    }

    body()
    {
        if( this._body instanceof MultiBuffer )
        {
            if( !this._decoded )
            {
                let content_transfer_encoding = this._headers.hasOwnProperty('content-transfer-encoding') ? this._headers['content-transfer-encoding'].toLowerCase() : null;

                if( content_transfer_encoding === 'quoted-printable' )
                {
                    this._body = new MultiBuffer( Buffer.from( Buffer.concat( this._body.slice() ).toString('utf8').replace(/=(?:\r\n|\n|\n\r)/g, '').replace(/=([0-9a-f]{2})/gi, ( m, hexCode ) => String.fromCharCode( parseInt( hexCode, 16 ) )), 'utf8') );
                }

                this._decoded = true;
            }

            return { headers: this._headers, body: Buffer.concat( this._body.slice()) };
        }
        else return this._body.map( b => b.body() );
    }
}
