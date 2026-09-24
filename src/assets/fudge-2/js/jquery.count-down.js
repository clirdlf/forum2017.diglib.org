window.requestAnimFrame = ( function() {
    return  window.requestAnimationFrame ||
        function( callback ){
            window.setTimeout( callback, 1000 / 60 );
        };
} )();

jQuery( function($) {

    $.each( $( '.countdown-timer div' ), function() {
        new Countdown ( $( this ) )
    } );

} );

var Countdown = function ( obj, calback ) {

    var _self = this,
        _obj = obj,
        _calback = calback || function() {},
        _milisecondsInSecond = 1000,
        _milisecondsInMinute = _milisecondsInSecond * 60,
        _milisecondsInHour = _milisecondsInMinute * 60,
        _milisecondsInDay = _milisecondsInHour * 24,
        _secondWrap = _obj.find( '.countdown-timer__seconds span' ),
        _minutesWrap = _obj.find( '.countdown-timer__minutes span' ),
        _hoursWrap = _obj.find( '.countdown-timer__hours span' ),
        _dayWrap = _obj.find( '.countdown-timer__days span' ),
        _stopped = false,
        _finishDate = new Date(_obj.data( 'finish' ));

    var _checkDate = function() {
            var difference = ( _finishDate - new Date() ),
                days = null,
                hours = null,
                minutes = null,
                seconds = null;

            if( difference > 0 ) {

                days = Math.floor( difference / _milisecondsInDay );
                hours =  Math.floor( ( difference - ( days * _milisecondsInDay ) ) / _milisecondsInHour );
                minutes = Math.floor( ( difference - ( ( days * _milisecondsInDay ) + ( hours * _milisecondsInHour ) ) ) / _milisecondsInMinute );
                seconds = Math.floor( ( difference - ( ( days * _milisecondsInDay ) + ( hours * _milisecondsInHour ) + ( minutes * _milisecondsInMinute ) ) ) / _milisecondsInSecond );

                _setСalculation( days, hours, minutes, seconds );

            } else {
                days = 0;
                hours =  0;
                minutes = 0;
                seconds = 0;

                _setСalculation( days, hours, minutes, seconds );

                _stopped = true;

                _calback();
            }
        },
        _init = function () {
            _obj[0].countdown = _self;
            _loop();
        },
        _loop = function() {

            _checkDate();

            if( !_stopped ) {
                requestAnimFrame( _loop );

            }
        },
        _setСalculation = function( days, hours, minutes, seconds){

            _secondWrap.text( seconds );
            _minutesWrap.text( minutes );
            _hoursWrap.text( hours );
            _dayWrap.text( days );

        };

    _init();
};