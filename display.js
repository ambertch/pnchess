(function() {

    var VERSION = '1.05';

    var ROOM = (location.href.match(/room=([^&]+)/)||['']).slice(-1)[0] || prompt('Chess Room Name?')

    var CHESS_CHANNEL_NAME = 'pnchess-' + VERSION + '-' + ROOM;

    var YOUR_NAME = (location.href.match(/nick=([^&]+)/)||['']).slice(-1)[0] || prompt('Your name?');

    var WHITE_PLAYER = 0;
    var BLACK_PLAYER = 1;

    var chatters = { };

    var pubnub = PUBNUB.init({
      subscribe_key   : 'sub-c-cbcff300-bb84-11e3-b6e0-02ee2ddab7fe',
      publish_key : 'pub-c-01bb4e6e-4ad8-4c62-9b72-5278a11cf9e5'
    });

    var game;

    var throttle = function(fn, threshhold, scope) {
      threshhold || (threshhold = 250);
      var last,
          deferTimer;
      return function () {
        var context = scope || this;

        var now = +new Date,
            args = arguments;
        if (last && now < last + threshhold) {
          // hold on to it
          clearTimeout(deferTimer);
          deferTimer = setTimeout(function () {
            last = now;
            fn.apply(context, args);
          }, threshhold);
        } else {
          last = now;
          fn.apply(context, args);
        }
      };
    };

    if (!Array.prototype.last){
        Array.prototype.last = function(){
            return this[this.length - 1];
        };
    };

    var get_all_history = function(args) {
        var channel  = args['channel']
        ,   callback = args['callback']
        ,   start    = 0
        ,   count    = 100
        ,   history  = []
        ,   params   = {
                channel  : channel,
                count    : count,
                reverse : false,
                callback : function(messages) {
                    var msgs = messages[0];
                    start = messages[1];
                    params.start = start;
                    pubnub.each( msgs.reverse(), function(m) {history.push(m)} );
                    if (msgs.length < count) return callback(history);
                    count = 100;
                    add_messages();
                }
            };

        add_messages();
        function add_messages() { pubnub.history(params) }
    }

    var parsePubnubMessage = function(data, type) {
      var messages = [];
      if (type === 'subscribe') {
        messages.push(data);
      } else if (type === 'history') {
        messages = data;
      }
      for (var idx in messages) {
        msg = messages[idx];
        if (msg.type === 'move') {
          if (type === 'subscribe' && msg.uuid === pubnub.get_uuid()) {
            return;
          }
          game.move(msg.start,msg.end,msg.promotion,msg.uuid);
        } else if (msg.type === 'chat') {
          var msg = '<' + (new Date(msg.date)).toLocaleString() + '> [' + msg.name + '] : ' + msg.msg;
          game.messages(msg);
        } else if (msg.type === 'start_moving_piece' && type === 'subscribe' && msg.uuid !== pubnub.get_uuid()) {
          game.start_moving_piece(msg.position, msg.uuid);
        } else if (msg.type === 'stop_moving_piece' && type === 'subscribe' && msg.uuid !== pubnub.get_uuid()) {
          game.stop_moving_piece(msg.uuid);
        } else if (msg.type === 'adjust_moving_piece' && type === 'subscribe' && msg.uuid !== pubnub.get_uuid()) {
          game.adjust_moving_piece(msg.x,msg.y);
        } else if (msg.type === 'display_games') {
          game.games(msg);
        } else if (msg.type === 'new_game') {
          game = p4wnify("chess-board");
          game.redrawChatters(chatters);
          game.refresh();
        }
      }
    };

    var getChatterState = function(uuid) {
      pubnub.state({
        channel : CHESS_CHANNEL_NAME,
        uuid : uuid,
        callback : function(data) {            
          if (data.hasOwnProperty('name')) {
            chatters[uuid] = data.name
            game.redrawChatters(chatters);
            game.refresh();
          }
        }
      });
    };

    var refreshChatters = function() {
      pubnub.here_now({
        channel : CHESS_CHANNEL_NAME,
        callback : function(msg) {          
          for (var idx in msg.uuids) {            
            getChatterState(msg.uuids[idx]);
          }
        }
      });
    };

    var parsePubNubPresence = function(message) {        
      if (message.action === 'join' && message.hasOwnProperty('data')) {
        chatters[message.uuid] = message.data.name;
        game.redrawChatters(chatters);
      } else if (message.action === 'join' && !message.hasOwnProperty('data')) {
        setTimeout(function() {
          getChatterState(message.uuid);
        }, 2000);
      } else if (message.action === 'leave' || message.action === 'timeout') {
        chatters[message.uuid] = null;
        delete chatters[message.uuid];
        game.redrawChatters(chatters);
      }
    };

    var sendChatMessage = function(msg) {
      pubnub.publish({
        channel : CHESS_CHANNEL_NAME,
        message : {
          date : (new Date()).toUTCString(),
          name : YOUR_NAME,
          type : 'chat',
          msg : msg
        }
      });
    };

    pubnub.subscribe({
      noheresync : true,
      channel : CHESS_CHANNEL_NAME,
      // state : {
      //   name: YOUR_NAME
      // },
      connect : function() {
        pubnub.$('room-name').innerHTML = ROOM;
        pubnub.$('person-name').innerHTML = YOUR_NAME;
        pubnub.here_now({
            callback : function(data){
                game.games(data);                
            }
        });
      },
      message : function(message) {
        parsePubnubMessage(message, 'subscribe');            
      },
      presence : function(message) {
        parsePubNubPresence(message);
      }
    });    


    pubnub.state({
        channel : CHESS_CHANNEL_NAME,
        uuid : pubnub.get_uuid(),
        state: {name: "akdjahsd"}
    })

    sendChatMessage('has joined!');

    setTimeout(function() {
      refreshChatters();
      get_all_history({
          channel  : CHESS_CHANNEL_NAME,
          callback : function(messages) {
            parsePubnubMessage(messages.reverse(), 'history');
          }
      });      
    },1000);

    var newGame = function() {
      pubnub.publish({
        channel : CHESS_CHANNEL_NAME,
        message : {            
          type : 'new_game'
        }
      });
    };

    window.newGame = newGame;


    /* p4wn, AKA 5k chess - by Douglas Bagnall <douglas@paradise.net.nz>
     *
     * This code is in the public domain, or as close to it as various
     * laws allow. No warranty; no restrictions.
     *
     * lives at http://p4wn.sf.net/
     */
    /* The routines here draw the screen and handle user interaction */

    var P4WN_SQUARE_WIDTH = 30;
    var P4WN_SQUARE_HEIGHT = 30;
    var P4WN_WRAPPER_CLASS = 'p4wn-wrapper';
    var P4WN_BOARD_CLASS = 'p4wn-board';
    var P4WN_MESSAGES_CLASS = 'p4wn-messages';
    var P4WN_SEND_MESSSAGE_CLASS = 'p4wn-send-message';
    var P4WN_STATUS_CLASS = 'p4wn-status';
    var P4WN_LOG_CLASS = 'p4wn-log';
    var P4WN_GAMES_CLASS = 'p4wn-games'
    var P4WN_PLAYERS_LIST_CLASS = 'p4wn-players-list';
    var P4WN_BLACK_SQUARE = 'p4wn-black-square';
    var P4WN_WHITE_SQUARE = 'p4wn-white-square';

    var P4WN_IMAGE_DIR = 'images';

    var P4WN_IMAGE_NAMES = [
        'empty.gif',
        '',   // 1 is unused
        'white_pawn.gif',
        'black_pawn.gif',
        'white_rook.gif',
        'black_rook.gif',
        'white_knight.gif',
        'black_knight.gif',
        'white_bishop.gif',
        'black_bishop.gif',
        'white_king.gif',
        'black_king.gif',
        'white_queen.gif',
        'black_queen.gif'
    ];


    /*the next two should match*/
    var P4WN_PROMOTION_STRINGS = ['queen', 'rook', 'knight', 'bishop'];

    var P4WN_PROMOTION_INTS = [P4_QUEEN, P4_ROOK, P4_KNIGHT, P4_BISHOP];

    var _p4d_proto = {};


    /* MSIE 6 compatibility functions */
    function _add_event_listener(el, eventname, fn){
        if (el.addEventListener === undefined){
            el.attachEvent('on' + eventname, fn);
        }
        else {
            el.addEventListener(eventname, fn);
        }
    }

    function _event_target(e){
        /*e.srcElement is not quite equivalent, but nothing is closer */
        return (e.currentTarget) ? e.currentTarget : e.srcElement;
    }

    _p4d_proto.square_clicked = function(square){
        var board = this.board_state.board;
        var mover = this.board_state.to_play;
        var uuid = pubnub.get_uuid();
        if (this.locked_players[mover] !== false && this.locked_players[mover] !== uuid) {
            p4_log("not your turn!");
            return;
        }
        var piece = board[square];
        if (this.start == square){
            //clicked back on previously chosen piece -- putting it down again
            this.stop_moving_piece();
        }
        else if (piece && (mover == (piece & 1))){
            //clicked on player's colour, so it becomes start
            this.start_moving_piece(square);
        }
        else if (this.move(this.start, square, P4WN_PROMOTION_INTS[this.pawn_becomes])){
            /*If the move works, drop the piece.*/
            //this.stop_moving_piece(square);
        }
    };

    _p4d_proto.move = function(start, end, promotion, do_not_broadcast){

        var uuid = pubnub.get_uuid();

        if (do_not_broadcast) {
            uuid = do_not_broadcast;
        }    
        if (this.locked_players[this.board_state.to_play] === false) {
            this.locked_players[this.board_state.to_play] = uuid;            
        } else if (this.locked_players[this.board_state.to_play] !== uuid) {
            this.messages('Someone has already claimed this color, please claim another color or spectate');
            return false;
        }

        var state = this.board_state;
        var move_result = state.move(start, end, promotion);
        if(move_result.ok){
            if (!do_not_broadcast) {
                pubnub.publish({
                    'channel': CHESS_CHANNEL_NAME,
                    'message': {
                        type:'move',
                        start: start,
                        end: end,
                        promotion: promotion,
                        uuid: pubnub.get_uuid()
                    }
                });
            }
            this.display_move_text(state.moveno, move_result.string);
            this.refresh();
        }
        else {
            p4_log("bad move!", start, end);
        }
        for (var i = 0; i < this.move_listeners.length; i++){
            this.move_listeners[i](move_result);
        }
        if (move_result.ok) {
            this.stop_moving_piece(start);
        }
        return move_result.ok;
    };

    _p4d_proto.display_move_text = function(moveno, string){
        var mn;
        if ((moveno & 1) == 0){
            mn = '    ';
        }
        else{
            mn = ((moveno >> 1) + 1) + ' ';
            while(mn.length < 4)
                mn = ' ' + mn;
        }
        this.log(mn + string, "p4wn-log-move");
    };

    _p4d_proto.log = function(msg, klass, onclick){
        var div = this.elements.log;
        var item = p4d_new_child(div, "div");
        item.className = klass;
        //if (onclick !== undefined)
            //_add_event_listener(item, "click", onclick);
        item.innerHTML = msg.replace(/[<>]/g,'');
        div.scrollTop = div.scrollHeight;
    }

    _p4d_proto.status = function(msg){
        var div = this.elements.status;
        div.innerHTML = msg.replace(/[<>]/g,'');
        sounds.play('chat');
    }

    _p4d_proto.messages = function(msg){
        var div = this.elements.messages;
        var item = p4d_new_child(div, "div");
        item.innerHTML = msg.replace(/[<>]/g,'');
        div.scrollTop = div.scrollHeight;
        sounds.play('chat');
    }

    _p4d_proto.games = function(msg){
        var div = this.elements.games;
        var totalGames = msg.total_channels;
        var html = "<div><b>" + totalGames + " current games</b> <i>(click to join)</i><div></div>";        
        var games = msg.channels;        
        for (var game in games) {
           var occupancy = games[game].occupancy;
           var gameName = game.split("-").last();
           html += "<div><a href='index.html?nick=" + YOUR_NAME + "&room=" + gameName + "'>" + gameName + "</a></div>"
        }
        div.innerHTML = html;
    }

    _p4d_proto.redrawChatters = function(msg){
        var div = this.elements.players_list;
        div.innerHTML = '';
        for (var idx in msg) {
            var item = p4d_new_child(div, "div");
            item.innerHTML = msg[idx].replace(/[<>]/g,'');
        }
        div.scrollTop = div.scrollHeight;
    }

    //refresh: redraw screen from board

    _p4d_proto.refresh = function(){
        var pieces = this.elements.pieces;
        var board = this.board_state.board;
        for (var i = 20; i < 100; i++){
            if(board[i] != P4_EDGE){
                var j = this.orientation ? 119 - i : i;
                pieces[j].src = P4WN_IMAGE_DIR + '/' + P4WN_IMAGE_NAMES[board[i]];
            }
        }
        if (chatters) {
            var uuid = this.locked_players[this.board_state.to_play];
            var color = this.board_state.to_play === WHITE_PLAYER ? 'WHITE' : 'BLACK';
            var name = chatters[uuid] ? chatters[uuid] : false;
            if (name) {
                this.status(color + "'s turn : (" + name + ")");
            } else {
                this.status(color + "'s turn");
            }
        }
    };

    _p4d_proto.adjust_moving_piece = function(x,y) {
        if (this.elements.moving_img) {
            this.elements.moving_img.style.left = x + "px";
            this.elements.moving_img.style.top = y + "px";
        }
    };

    _p4d_proto.start_moving_piece = function(position, do_not_broadcast){
        /*drop the currently held one, if any*/
        this.stop_moving_piece(true);
        if (!do_not_broadcast) {
            pubnub.publish({'channel':CHESS_CHANNEL_NAME,'message':{type:'start_moving_piece',position:position,uuid:pubnub.get_uuid()}});
        }
        this.elements.orig_img = this.elements.pieces[this.orientation ? 119 - position : position];
        var img = this.elements.pieces[this.orientation ? 119 - position : position].cloneNode(false);
        this.elements.orig_img.style.opacity = '0.2';
        this.elements.orig_img.parentNode.appendChild(img);
        this.elements.moving_img = img;
        var old_msie = /MSIE [56]/.test(navigator.userAgent);
        img.style.position = (old_msie) ? 'absolute': 'fixed';
        var yoffset = parseInt(P4WN_SQUARE_HEIGHT / 2);
        if (window.event){
            img.style.left = (window.event.clientX + 1) + "px";
            img.style.top = (window.event.clientY - yoffset) + "px";
        }
        this.start = position;
        var throttledPublish = throttle(function() {
            pubnub.publish({'channel':CHESS_CHANNEL_NAME,'message':{type:'adjust_moving_piece',x:x,y:y,uuid:pubnub.get_uuid()}});
        }, 500);
        if (!do_not_broadcast) {
            document.onmousemove = function(e){
                e = e || window.event;
                x = (e.clientX + 1);
                y = (e.clientY - yoffset);
                img.style.left = x + "px";
                img.style.top = y + "px";
                throttledPublish();
            };
        }
    };

    _p4d_proto.stop_moving_piece = function(do_not_broadcast){
        if (!do_not_broadcast) {
            pubnub.publish({'channel':CHESS_CHANNEL_NAME,'message':{type:'stop_moving_piece',uuid:pubnub.get_uuid()}});
        }
        if (this.elements.orig_img) {
            this.elements.orig_img.style.opacity = '1.0';
        }
        var img = this.elements.moving_img;
        if (img){
            img.parentNode.removeChild(img);
        }
        this.start = 0;
        this.elements.moving_img = undefined;
        document.onmousemove = null;
    };

    function p4d_new_child(element, childtag, className){
        var child = document.createElement(childtag);
        element.appendChild(child);
        if (className !== undefined)
            child.className = className;
        return child;
    }

    _p4d_proto.write_board_html = function(){
        var div = this.elements.board;
        var pieces = this.elements.pieces = [];
        var table = p4d_new_child(div, "table");
        var tbody = p4d_new_child(table, "tbody");
        for (var y = 9; y > 1; y--){
            var tr = p4d_new_child(tbody, "tr");
            for(var x = 1;  x < 9; x++){
                var i = y * 10 + x;
                var td = p4d_new_child(tr, "td");
                td.className = (x + y) & 1 ? P4WN_BLACK_SQUARE : P4WN_WHITE_SQUARE;
                _add_event_listener(td, 'click',
                                    function(p4d, n){
                                        return function(e){
                                            p4d.square_clicked(p4d.orientation ? 119 - n : n);
                                        };
                                    }(this, i));
                var img = p4d_new_child(td, "img");
                pieces[i] = img;
                img.src = P4WN_IMAGE_DIR + '/' + P4WN_IMAGE_NAMES[0];
                img.width= P4WN_SQUARE_WIDTH;
                img.height= P4WN_SQUARE_HEIGHT;
            }
        }
    };

    _p4d_proto.refresh_buttons = function(){
        var rf = this.buttons.refreshers;
        for (var i = 0; i < rf.length; i++){
            var x = rf[i];
            x[0].call(this, x[1]);
        }
    };

    function P4wn_display(target){
        if (! this instanceof P4wn_display){
            return new P4wn_display(target);
        }
        var container;
        if (typeof(target) == 'string')
            container = document.getElementById(target);
        else if (target.jquery !== undefined)
            container = target.get(0);
        else
            container = target;
        container.innerHTML = '';
        var inner = p4d_new_child(container, "div", P4WN_WRAPPER_CLASS);
        this.elements = {};
        this.elements.inner = inner;
        this.elements.container = container;
        this.elements.status = p4d_new_child(inner, "div", P4WN_STATUS_CLASS);
        this.elements.board = p4d_new_child(inner, "div", P4WN_BOARD_CLASS);
        this.elements.players_list = p4d_new_child(inner, "div", P4WN_PLAYERS_LIST_CLASS);
        this.elements.log = p4d_new_child(inner, "div", P4WN_LOG_CLASS);
        this.elements.games = p4d_new_child(inner, "div", P4WN_GAMES_CLASS);
        this.elements.send_message = p4d_new_child(inner, "input", P4WN_SEND_MESSSAGE_CLASS);
        this.elements.messages = p4d_new_child(inner, "div", P4WN_MESSAGES_CLASS);
        this.start = 0;
        this.board_state = p4_new_game();
        this.pawn_becomes = 0; //index into P4WN_PROMOTION_* arrays
        this.buttons = {
            elements: [],
            refreshers: []
        };
        this.locked_players = [false, false];
        this.move_listeners = [];
        self = this;
        pubnub.bind('keypress', self.elements.send_message, function(e) {
            if (e.which === 13) {
                sendChatMessage(self.elements.send_message.value);
                self.elements.send_message.value = '';
            }
            return true;
        });
        return this;
    }

    function p4wnify(id){
        var p4d = new P4wn_display(id);
        var e = p4d.elements;        
        var board_height = (8 * (P4WN_SQUARE_HEIGHT + 3)) + 'px';
        e.inner.style.height = board_height;
        e.log.style.height = board_height;
        e.board.style.height = board_height;
        e.players_list.style.height = board_height;
        p4d.write_board_html();
        p4d.refresh();
        return p4d;
    }

    P4wn_display.prototype = _p4d_proto;

    game = p4wnify("chess-board");

}());