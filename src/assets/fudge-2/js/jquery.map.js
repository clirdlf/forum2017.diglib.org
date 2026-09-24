var Location;
    'use strict';

    Location = function ( obj ) {

        //private properties
        var _self = this,
            _obj = obj,
            _path = _obj.data( 'action' ),
            _lat = _obj.attr( 'data-lat' ),
            _lng = _obj.attr( 'data-lng' ),
            _myLatLng = {lat: parseFloat( _lat ), lng: parseFloat( _lng )},
            _wherePopup = jQuery( '.where__popup' ),
            _where__labels = jQuery( '.where__labels' ),
            _where__text = _wherePopup.find( '.where__text' ),
            _moreBtnAll = _wherePopup.find( '.where__links.where_view-all' ),
            _moreBtnBack = _wherePopup.find( '.where__links.where_back' ),
            _map = null,
            _scroll = null,
            _isRequest = true,
            _request = new XMLHttpRequest(),
            _window = jQuery( window ),
            delta = 3.3,
            deltaY = 1.4,
            markerZoom = 10;
        _self.markers = [];
        _self.bounds = [];

        //private methods
        var _addEvents = function () {
                if ( _moreBtnAll.length > 0 ) {
                    jQuery(_moreBtnAll).on( 'click' , function () {
                        _where__text.fadeOut();
                        _moreBtnAll.css( 'display', 'none' );
                        _moreBtnBack.fadeIn();
                        if (_isRequest) {
                            _ajaxRequest();
                        } else {
                            _showPlacemark();
                        }
                        _initScroll();
                        return false;
                    });
                }
                if (_moreBtnBack.length > 0) {
                    jQuery(_moreBtnBack).on( 'click', function () {
                        _where__text.fadeIn();
                        _moreBtnBack.css( 'display', 'none' );
                        _moreBtnAll.fadeIn();
                        _hidePlacemarks();
                        _destroyScroll();
                        return false;
                    });
                }
                jQuery(_where__labels).on( 'click', '.label', function () {
                    var location_id = jQuery( this ).data( 'id' );

                    if ( location_id > 0 ) {
                        _hideAllInfo();
                        _checkPlacemerk( location_id );
                    }
                });
            },
            _ajaxRequest = function () {
                var loadedPois = [];
                _obj.parent().parent().find('.label_big').each( function() {
                    loadedPois.push(jQuery(this).data('id'));
                });
                loadedPois = loadedPois.join();
                _request.abort();
                _request = jQuery.ajax({
                    url: fudgeJS.ajax_url,
                    data: {
                        action : 'fudge_load_pois',
                        loadedItems: loadedPois
                    },
                    dataType: 'json',
                    timeout: 20000,
                    type: "GET",
                    success: function ( data ) {
                        _isRequest = false;
                        _getLocations( _map, data.locations, _self.markers );
                    },
                    error: function ( XMLHttpRequest ) {
                        if ( XMLHttpRequest.statusText != "abort" ) {
                            alert("Error!");
                        }
                    }
                });
            },
            _checkPlacemerk = function ( id ) {
                var place = _findPlacemark( id );
                if ( place !== false ) {
                    if ( _window.width() >= 767 ) {
                        _map.panTo({
                            lat: place.getPosition().lat(),
                            lng: place.getPosition().lng() - delta / markerZoom
                        });
                    } else {
                        _map.panTo({
                            lat: place.getPosition().lat() - deltaY / markerZoom,
                            lng: place.getPosition().lng()
                        });
                    }
                    _map.setZoom( markerZoom );
                    place.info.open(_map, place);
                }
            },
            _findPlacemark = function ( id ) {
                for ( var i = 0; i < _self.markers.length; i++ ) {
                    if ( _self.markers[ i ].id == id ) {
                        return _self.markers[ i ];
                    }
                }
                return false;
            },
            _destroyScroll = function () {
                if ( _scroll !== null ) {
                    _scroll.remove();
                    _scroll = null;
                }
            },
            _getLocations = function ( map, data, container ) {

                _self.data = data || JSON.parse( _obj.attr( 'data-map' ) ).locations;

                jQuery.each( _self.data, function ( i ) {

                    var curLatLng = new google.maps.LatLng( this.coordinates[ 0 ], this.coordinates[ 1 ] );
                    _self.bounds.extend( curLatLng );
                    var place = new google.maps.Marker({
                        position: curLatLng,
                        map: map,
                        icon: {
                            url: this.icon,
                            size: new google.maps.Size( 40, 47 ),
                            origin: new google.maps.Point( 0, 0 ),
                            anchor: new google.maps.Point( 20, 59 )
                        },
                        title: this.title
                    });

                    place.id = this.id;
                    place.color = this.color;
                    place.desc = this.description;
                    if (data !== null) {
                        place._new = true;
                    }
                    place.info = new google.maps.InfoWindow( {
                        content: this.description
                    });

                    _showAllLocations( this );

                    container.push( place );

                    _setInfoWindow( i, place );

                });
                map.fitBounds( _self.bounds );
            },
            _hideAllInfo = function () {
                for ( var i = 0; i < _self.markers.length; i++ ) {
                    _self.markers[ i ].info.close();
                }
            },
            _hidePlacemarks = function () {
                for ( var i = 0; i < _self.markers.length; i++ ) {
                    if ( _self.markers[ i ]._new == true ) {
                        jQuery( _where__labels ).find( '.label[data-id=' + _self.markers[ i ].id + ']' ).remove();
                        _self.markers[ i ].setMap( null );
                    }
                }
            },
            _initMap = function () {

                _map = new google.maps.Map( _obj[ 0 ], {
                    zoom: 13,
                    center: _myLatLng,
                    scrollwheel: false,
                    draggable: true
                });

                _self.bounds = new google.maps.LatLngBounds(),
                    _getLocations( _map, null, _self.markers );
            },
            _initScroll = function () {
                if ( _scroll == null )
                    _scroll = _wherePopup.find( '.where__layout' ).niceScroll( {
                        cursorcolor: "#f3f3f3",
                        cursoropacitymin: "1",
                        cursorborderradius: "3px",
                        cursorborder: "none",
                        cursorwidth: "5",
                        enablemousewheel: true
                    });

            },
            _setInfoWindow = function ( index, place ) {
                google.maps.event.addListener( place, 'click', function (e) {
                    _checkPlacemerk( place.id );
                    place.info.open( _map, place );
                    return false;
                });
            },
            _showAllLocations = function ( data ) {
                var listLocations = '';
                listLocations += '<span class="label label_big" style="background-color: ' + data.color + '" data-id="' + data.id + '">' + data.title + '</span>';
                _where__labels.append( listLocations );
            },
            _showPlacemark = function () {
                for ( var i = 0; i < _self.markers.length; i++ ) {
                    if (_self.markers[ i ]._new == true) {
                        _showAllLocations( _self.markers[ i ] );
                        _self.markers[ i ].setMap( _map );
                    }
                }
            },
            _init = function () {
                _initMap();
                _addEvents();
            };

        _init();
    };


var initMap = function () {
    if ( jQuery( '#map').length ) {
        new Location( jQuery( '#map' ) );
    }
};


