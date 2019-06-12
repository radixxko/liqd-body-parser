Uploader = new( function()
{
    var self = this,
        options = {},
        holder,
        tests,
        acceptedTypes = [
            /*'image/png',
            'image/jpeg',
            'image/gif'*/
        ];

    this.init = function( _options_ )
    {
        var hash = _options_.fileElement;
        options[ hash ] = _options_;
		options[ hash ].request = null;
        holder = document.querySelector( options[ hash ].fileElement );
        if( !holder ){ return; }
        tests =
            {
                filereader: typeof FileReader != 'undefined',
                dnd: 'draggable' in document.createElement('span'),
                formdata: !!window.FormData,
                progress: "upload" in new XMLHttpRequest
            };

        if( typeof options[ hash ].acceptedTypes != 'undefined' && options[ hash ].acceptedTypes.length > 0 ){ acceptedTypes = options[ hash ].acceptedTypes; }else{ options[ hash ].acceptedTypes = acceptedTypes; }
        if (tests.dnd) { }

        var inputElement = document.createElement('input'),

            inputElementOption = {'onchange' : 'return Uploader.onchange(this);', 'type' : 'file', 'accept' : acceptedTypes.join(','), 'style' : 'display:none;'};

        if( typeof options[ hash ].multiupload != 'undefined' && options[ hash ].multiupload )
        {
            inputElementOption['multiple'] = 'multiple';
        }

        for( var attribute in inputElementOption ){ inputElement.setAttribute( attribute, inputElementOption[attribute] ); }

        document.querySelector( hash ).appendChild( inputElement );

    };

    this.onclick = function( element, event )
    {
        var hash = '#'+element.id;
        element.querySelector( 'input[type="file"]' ).click();
    }
    this.onchange = function( element, event )
    {
        var hash = '#'+element.parentNode.id;
        uploadFile(element, hash);
    }

    this.ondrop = function (element, event)
    {
        var hash = '#'+element.id;
        element.className = ( ( typeof options[ hash ].dragendClass != 'undefined' )?( options[ hash ].dragendClass ):( '' ) );
        event.preventDefault();

        uploadFile( event.dataTransfer, hash );
    }

    this.ondragend = function (element, event)
    {
        var hash = '#'+element.id;
        element.className = ( ( typeof options[ hash ].dragendClass != 'undefined' )?( options[ hash ].dragendClass ):( '' ) );
        return false;

    }

    this.ondragleave = function ( element, event )
    {
        var hash = '#'+element.id;
        element.className = ( ( typeof options[ hash ].dragleaveClass != 'undefined' )?( options[ hash ].dragleaveClass ):( '' ) );
        return false;
    }

    this.ondragover = function ( element, event )
    {
        var hash = '#'+element.id;
        element.className = ( ( typeof options[ hash ].dragoverClass != 'undefined' )?( options[ hash ].dragoverClass ):( '' ) );
        return false;
    }

    this.changeUrl = function( hash, url )
    {
        options[ hash ].url = url;
    }

    this.getSize = function( size )
    {
        var s_size = 0;

        if( size < 1024 ){ s_size = Math.round( size * 100 ) / 100 +'B'; }
        else if( size < ( 1024 * 1024 ) ){ s_size = Math.round( ( size / 1024 ) * 100 ) / 100 +'kB'; }
        else{ s_size = Math.round( ( size / 1024 / 1024 ) * 100 ) / 100 +'MB'; }

        return s_size;
    }

    function uploadFile(files, hash)
    {
        if( typeof files.getData != 'undefined' && files.getData('text/plain') )
        {
			options[ hash ].request = uploadRequest( hash, 'file', files.getData('text/plain') )
        }
        else
        {
            var _files = files.files;
            if( typeof options[ hash ].multiupload != 'undefined' && options[ hash ].multiupload )
            {
                for (var i = 0; i < _files.length; i++)
                {
					options[ hash ].request = uploadRequest( hash, _files[i].name, _files[i] );
                }
            }
            else
            {
                if( options[ hash ].request ){ options[ hash ].request.abort(); }
				options[ hash ].request = uploadRequest( hash, _files[0].name, _files[0] );
            }
        }
    }


	function uploadRequest( hash, name, file )
    {
        var formData = tests.formdata ? new FormData() : null;
        var uid = new Date().getTime();

        var isAcceptedTypes = true;
		for( var i = 0; options[ hash ].acceptedTypes.length > i; ++i ){ if(  file.name.indexOf( options[ hash ].acceptedTypes[i] ) > -1 && ( options[ hash ].acceptedTypes[i].length + file.name.indexOf( options[ hash ].acceptedTypes[i] ) ) == file.name.length ){ isAcceptedTypes = false; break; } }

		if( isAcceptedTypes && options[ hash ].acceptedTypes.length > 0 ){ return; }

        if (tests.formdata)
        {
            formData.append( name, file );
            formData.append('id', options[ hash ].id );

            if( typeof options[ hash ].prerender != 'undefined' )
            {
                options[ hash ].prerender( uid, name );
            }
            var xhr = new XMLHttpRequest();
                xhr.open('POST', options[ hash ].url);
                xhr.onload = function(){ };
                xhr.onreadystatechange = function()
                {
                    if( this.readyState == 4 )
                    {
						options[ hash ].render( this.responseText, uid );
                    }
					options[ hash ].request = null;
                }
                xhr.uid = uid;
                xhr.upload.addEventListener("progress", function(evt){ progressFunction(evt, hash, uid) }, false);

                xhr.send(formData);

            return xhr;
        }
    }
    function progressFunction(evt, hash, uid)
    {
        if( evt.lengthComputable && document.querySelector( '#progress_'+uid ) != null || ( typeof options[ hash ].progressIndicator  != 'undefined' && document.querySelector( options[ hash ].progressIndicator ) != null ) )
        {
            var progressIndicator = ( typeof options[ hash ].progressIndicator  != 'undefined' ? options[ hash ].progressIndicator : '#progress_'+uid );
            var progressBar = document.querySelector( progressIndicator );
            var percentageDiv = progressBar.parentNode.querySelector('span.percentage-indicator');
            if(!percentageDiv){ percentageDiv = document.createElement('span'); percentageDiv.className = 'percentage-indicator'; progressBar.parentNode.appendChild(percentageDiv); }

            var progress = Math.round(evt.loaded / evt.total * 100);

            if( progress == 0 )
            {
                progressBar.style.width = '0%';
                percentageDiv.innerHTML = '0%';
            }
            else if( progress < 100 )
            {
                progressBar.style.width = progress+'%';
                percentageDiv.innerHTML = progress+'%';
            }
            else
            {
                progressBar.style.width = '99%';
                percentageDiv.innerHTML = '99%';
            }
        }
    }
});
