
Chess powered by Pubnub
=======

Play and/or spectate chess with anyone in the world, without a game server!

[Try it out here!](http://pubnub.github.io/pnchess/) (first two players in a room that make moves claim the board, spectators subsequently join)

![alt text](/screenshot.png)

JavaScript chess library credited to : https://github.com/douglasbagnall/p4wn

Network communications added by Cody Massin and Ambert Ho using [PubNub's javascript library](https://github.com/pubnub/javascript)

[More information about PubNub](http://www.pubnub.com)


###Pubnub building blocks used###
* during the game, moves are transmitted via the PubNub *data stream*
* players in a lobby are retrieved using the *presence* API
* upon entering a game already in session, the *history* API retrieves the history of players' moves
* player names are persisted using the *state* API
