// ==UserScript==
// @name          TagPro Analytics
// @namespace     http://tagpro.eu
// @description   Advanced gameplay data collector for TagPro (see http://tagpro.eu)
// @include       http://tagpro.eu/
// @include       http://tagpro-*.koalabeast.com:*
// @include       http://tangent.jukejuice.com:*
// @include       http://*.newcompte.fr:*
// @include       http://tagpro-*.koalabeast.com/
// @include       http://tangent.jukejuice.com/
// @include       http://*.newcompte.fr/
// @include       http://tagpro-*.koalabeast.com/*
// @include       http://tangent.jukejuice.com/*
// @include       http://*.newcompte.fr/*
// @grant         GM_getValue
// @grant         GM_setValue
// @author        Ronding
// @version       2.0
// ==/UserScript==

// Copyright (c) 2016, Jeroen van der Gun
// All rights reserved.
//
// Use in source and binary forms, without modification, is permitted. Redistribution is not
// permitted.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
// EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
// MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL
// THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT
// OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
// HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
// TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
// SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

(function(){
var script = document.createElement('script');
script.textContent = 'window.tagproAnalytics = ' + GM_getValue('TagProAnalytics', '{}') + ';(' + function(){

// begin unprivileged client

if(location.hostname == 'tagpro.eu') tagproAnalyticsCallback();
else if(!location.port || (location.port >= 8000 && location.port < 8050)) {
console.log('TagPro Analytics running in non-league mode.');

// begin league mode code

if(!location.port || location.port < 8000)
{
 var li = document.createElement('li');
 var a = document.createElement('a');
 a.href = 'http://tagpro.eu';
 a.textContent = 'Analytics';
 li.appendChild(a);
 document.getElementById('site-nav').getElementsByTagName('ul')[0].appendChild(li);
}

else
 tagpro.ready(function()
 {

  function Event(time, emptySize)
  {
   var that = this;
   var data = '';
   var byte = 0;
   var size = 0;
   this.empty = true;
   this.time = time;
   this.emptySize = emptySize;
   this.write = function(bits, length)
   {
    while(length--)
    {
     byte <<= 1;
     if(bits & 1 << length)
     {
      byte |= 1;
      that.empty = false;
     }
     if(++size == 8)
     {
      data += String.fromCharCode(byte);
      byte = 0;
      size = 0;
     }
    }
   };
   this.tally = function(number)
   {
    while(number--)
     that.write(1, 1);
    that.write(0, 1);
   };
   this.finish = function(last)
   {
    var footer = that.time - last - 1;
    if(footer < 0) footer = 0; // force time difference into positive domain (last resort, shifts rest of timeline)
    var free = 8 - (size + 2 & 7) & 7;
    var minimum = 0;
    for(var maximum = 1 << free; maximum <= footer; maximum += 1 << free)
    {
     minimum = maximum;
     free += 8;
    }
    that.write(free >>> 3, 2);
    that.write(footer - minimum, free);
    return data;
   };
   this.pad = function()
   {
    that.write(0, 8 - (size & 7) & 7);
    return data;
   };
  }

  var group = '';
  var mapInfo = {};
  var mapDimensions = new Uint32Array(2);
  var mapTiles = '';
  var mapGridBits = new Uint8Array(2);
  var mapGridMargin = new Uint32Array(2);
  var mapMarsballs = 0;
  var marsballs = {};
  var unfinalized = true;
  var complete = false;
  var gameNow = new Date();
  var lastTime = 0;
  var lastNow = gameNow.getTime();
  var minTime = 1;
  var gameStart = NaN;
  var timeLimit = 0;
  var teamNames = ['Red', 'Blue'];
  var teamScores = new Uint32Array(2);
  var players = {};
  var lastPlayer = 0;
  var splats = [new Event(0,0), new Event(0,0)];
  var queuedSplats = [[],[]];

  var div = document.createElement('div');
  div.style.margin = '10px 0';
  div.appendChild(document.createTextNode('TagPro Analytics is disabled (you joined later)'));
  document.getElementById('stats').parentNode.insertBefore(div, document.getElementById('stats').nextSibling);
  
  tagpro.socket.on('groupId', function(data)
  {
   group = data || '';
  });
  
  tagpro.socket.on('map', function(data)
  {
   if(mapTiles == '')
   {
    if(data.info)
     mapInfo = data.info;
    if(mapDimensions[0] = data.tiles.length)
     mapDimensions[1] = data.tiles[0].length;
    var last = 0, count = 0;
    function append()
    {
     if(count)
     {
      var event = new Event(count, 0);
      event.write(last, 6);
      mapTiles += event.finish(0);
     }
    }
    for(var y = 0; y < mapDimensions[1]; y++)
     for(var x = 0; x < mapDimensions[0]; x++)
     {
      var tile = data.tiles[x][y] * 10 >>> 0;
      if(tile < 10) tile = 0;
      else if(tile < 20) tile -= 9;
      else if(tile < 90) tile = 4 + (tile / 10 >>> 0);
      else if(tile < 100) tile -= 77;
      else if(tile < 130) tile = 7 + (tile / 10 >>> 0);
      else if(tile < 140) tile -= 110;
      else tile = 8 + (tile / 10 >>> 0);
      if(tile == last) count++;
      else
      {
       append();
       last = tile, count = 1;
      }
     }
    append();
    for(var dimension = 0; dimension < 2; dimension++)
    {
     var size = mapDimensions[dimension] * 40;
     if(size)
     {
      var grid = size - 1;
      mapGridBits[dimension] = 32;
      if(!(grid & 0xFFFF0000)) mapGridBits[dimension] -= 16, grid <<= 16;
      if(!(grid & 0xFF000000)) mapGridBits[dimension] -=  8, grid <<=  8;
      if(!(grid & 0xF0000000)) mapGridBits[dimension] -=  4, grid <<=  4;
      if(!(grid & 0xC0000000)) mapGridBits[dimension] -=  2, grid <<=  2;
      if(!(grid & 0x80000000)) mapGridBits[dimension] -=  1;
     }
     mapGridMargin[dimension] = ((1 << mapGridBits[dimension]) - size >>> 1) + 20; // add 20 px to get ball center
    }
   }
  });

  tagpro.socket.on('teamNames', function(data)
  {
   if(data.redTeamName) teamNames[0] = data.redTeamName;
   if(data.blueTeamName) teamNames[1] = data.blueTeamName;
  });

  tagpro.socket.on('score', function(data)
  {
   if('r' in data) teamScores[0] = data.r;
   if('b' in data) teamScores[1] = data.b;
  });

  tagpro.socket.on('time', function(data)
  {
   var dateNow = new Date();
   var now = dateNow.getTime();
   if(data.state == 3)
   {
    div.removeChild(div.firstChild);
    div.style.fontWeight = 'bold';
    div.appendChild(document.createTextNode('TagPro Analytics is recording'));
    complete = true;
   }
   else if(complete)
   {
    gameNow = dateNow;
    var deadline = ((now - lastNow) * .06 >>> 0) + lastTime + Math.round(data.time * .06);
    timeLimit = Math.round(data.time / 60000);
    gameStart = deadline - timeLimit * 3600;
   }
  });
  
  function finalize(finished)
  {
   var now = Date.now();
   if(unfinalized && complete && gameStart == gameStart)
   {
    unfinalized = false;
    var submit =
    {
     server: location.hostname, port: parseInt(location.port, 10), group: group, date: gameNow.getTime() / 1000 >>> 0,
     timeLimit: timeLimit, duration: Math.max(((now - lastNow) * .06 >>> 0) + lastTime, minTime) - gameStart, finished: finished,
     map: {name: mapInfo.name || 'Untitled', author: mapInfo.author || 'Unknown', marsballs: mapMarsballs, width: mapDimensions[0], tiles: btoa(mapTiles)},
     players: [],
     teams: [{name: teamNames[0], score: teamScores[0], splats: btoa(splats[0].pad())}, {name: teamNames[1], score: teamScores[1], splats: btoa(splats[1].pad())}]
    };
    for(var id = 1; id <= lastPlayer; id++)
     if(id in players)
     {
      var served = [id];
      var player = players[id];
      if(player.timeline.length || player.initialTeam)
      {
       var events = '';
       var last = gameStart;
       var concatenate = function()
       {
        var emptySize = 7;
        for(var i = 0, j = new Uint32Array(3);;)
        {
         var type = 0, time = Infinity;
         if(i < player.timeline.length) type = 1, time = player.timeline[i].time;
         for(var k = 0; k < 3; k++)
          if(j[k] < player.toggles[k].length)
          {
           if(player.toggles[k][j[k]] < time) type = 2 << k, time = player.toggles[k][j[k]];
           else if(player.toggles[k][j[k]] == time) type |= 2 << k;
          }
         if(!type) break;
         var event;
         if(type & 1) event = player.timeline[i];
         else { event = new Event(time, emptySize); event.write(0, emptySize); }
         for(var k = 0; k < 3; k++) event.write(player.toggles[k][j[k]] == time, 1);
         events += event.finish(last);
         last = time;
         if(type & 1) { i++; emptySize = event.emptySize; }
         for(var k = 0; k < 3; k++) if(type & 2 << k) j[k]++;
        }
       };
       concatenate();
       var auth = player.auth, name = player.name, flair = player.flair, initialTeam = player.initialTeam;
       if(player.lastTime && player.lastName) // merge players before and after refreshing
        for(var currentId = id + 1; currentId <= lastPlayer; currentId++)
         if(currentId in players)
         {
          var currentPlayer = players[currentId];
          if(currentPlayer.firstTime > player.lastTime && currentPlayer.firstName == player.lastName && (!player.lastAuth || (currentPlayer.auth && currentPlayer.name == player.name)) && currentPlayer.degree == player.degree)
          {
           player = currentPlayer;
           if(!auth && player.name) name = player.name;
           if(player.auth) auth = true;
           if(player.flair) flair = player.flair;
           concatenate();
           served.push(currentId);
           if(!player.lastTime || !player.lastName) break;
          }
         }
       submit.players.push(
       {
        auth: auth, name: name, flair: flair, degree: player.degree,
        score: player.score, points: player.points,
        team: initialTeam, events: btoa(events)
       });
      }
      for(var i in served) delete players[served[i]];
     }
    
    var json = JSON.stringify(submit);
    console.log(json);
    div.removeChild(div.firstChild);
    var a = document.createElement('a');
    a.href = 'data:application/octet-stream,' + encodeURIComponent(json);
    a.appendChild(document.createTextNode('Save'+(finished?'':' Partial')+' TagPro Analytics file'));
    div.appendChild(a);
    if(finished)
    {
     div.appendChild(document.createTextNode(' | '));
     var u = document.createElement('a');
     u.href = 'http://tagpro.eu/';
     if(group) u.target = '_blank';
     u.style.color = 'silver';
     u.appendChild(document.createTextNode('Uploading match to website...'));
     div.appendChild(u);
    }
    else
    {
     a.style.backgroundColor = 'red'; a.style.color = 'white';
     div.appendChild(document.createTextNode(' (recording interrupted)'));
    }
    
    if(window.tagproAnalytics)
    {
     if(!window.tagproAnalytics.secret)
     {
      var secret = new Uint8Array(8);
      crypto.getRandomValues(secret);
      window.tagproAnalytics.secret = btoa(String.fromCharCode.apply(null, secret));
     }
     if(window.tagproAnalytics.matches)
     {
      window.tagproAnalytics.matches.splice(9);
      window.tagproAnalytics.matches.unshift(submit);
     }
     else
      window.tagproAnalytics.matches = [submit];
     document.body.dataset.tagproAnalytics = JSON.stringify(window.tagproAnalytics);
    }
    if(finished)
    {
     var xhr = new XMLHttpRequest();
     xhr.open('POST', 'http://tagpro.eu/submit/');
     xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
     xhr.onreadystatechange = function()
     {
      if(xhr.readyState == 4)
      {
       u.removeChild(u.firstChild);
       if(xhr.status == 202)
       {
        submit.upload = xhr.responseText;
        if(window.tagproAnalytics)
         document.body.dataset.tagproAnalytics = JSON.stringify(window.tagproAnalytics);
        u.href = 'http://tagpro.eu/' + xhr.responseText;
        u.style.color = '';
        u.appendChild(document.createTextNode('View match on website'));
       }
       else
       {
        u.style.backgroundColor = 'red'; u.style.color = 'white';
        u.appendChild(document.createTextNode(xhr.responseText ? xhr.responseText : 'Unknown error during upload to website'));
       }
      }
     };
     xhr.send('data=' + encodeURIComponent(json) + '&clock=' + (Date.now() / 1000 >>> 0) + '&secret=' + encodeURIComponent(window.tagproAnalytics ? window.tagproAnalytics.secret : 'LeagueOnlyA=') + '&version=8');
    }
   }
  }

  tagpro.socket.on('end', function(data)
  {
   finalize(true);
  });
  function stop()
  {
   finalize(false);
  }
  tagpro.socket.on('disconnect', stop)
  document.getElementById('exit').addEventListener('click', stop);

  tagpro.socket.on('object', function(data)
  {
   if(data.type == 'marsball' && !(data.id in marsballs))
   {
    mapMarsballs++;
    marsballs[data.id] = null;
   }
  });

  tagpro.socket.on('playerLeft', function(id)
  {
   var now = Date.now();
   var player = players[id];
   if(player)
   {
    if(gameStart == gameStart)
    {
     player.lastTime = ((now - lastNow) * .06 >>> 0) + lastTime;
     if(player.timeline.length && player.timeline[player.timeline.length-1].time >= player.lastTime)
      player.lastTime = player.timeline[player.timeline.length-1].time + 1;
     player.team = 0;
     if(player.score > 0) player.score = 0;
     var event = new Event(player.lastTime, 7);
     event.write(3, 2); // quit
     event.write(0, 1); // pop
     event.tally(0); // returns
     event.tally(0); // tags
     if(!player.flag) event.write(0, 1); // grab
     event.tally(0); // captures
     event.tally(0); // powerups
     for(var power = 1; power < 16; power <<= 1)
      if(player.powers & power)
       event.write(0, 1); // power down
     player.timeline.push(event);
    }
    else
     delete players[id];
   }
  });

  tagpro.socket.on('splat', function(data)
  {
   if(gameStart == gameStart) queuedSplats[data.t-1].push(data);
  });

  tagpro.socket.on('p', function(data)
  {
   var now = Date.now();
   var time = data.t || 0;
   if(time)
   {
    lastTime = time;
    lastNow = now;
    if(time <= gameStart) gameStart = time-1;
   }
   else
    time = ((now - lastNow) * .06 >>> 0) + lastTime;
   if(time < minTime)
    time = minTime;
   data = data.u || data;
   var expectedSplats = new Uint32Array(2);
   
   for(var i = 0; i < data.length; i++)
   {
    var newPlayer = data[i];
    var player = players[newPlayer.id];
    if(player) player.message++;
    else
    {
     if(newPlayer.id > lastPlayer) lastPlayer = newPlayer.id;
     player = players[newPlayer.id] =
     {
      firstTime: gameStart == gameStart ? time : 0, lastTime: 0, firstName: '', lastName: '', lastAuth: false,
      auth: false, name: '', flair: 0, degree: 0,
      score: 0, points: 0,
      team: 0, initialTeam: 0, flag: 0, potato: 0, powers: 0,
      's-pops': 0, 's-captures': 0, 's-grabs': 0, 's-returns': 0, 's-tags': 0, 's-powerups': 0, 's-prevent': 0, 's-support': 0,
      timeline: [], toggles: [[],[],[]], message: gameStart == gameStart ? 0 : 1
     };
    }
    if(newPlayer.name)
    {
     if(!player.auth) player.name = newPlayer.name;
     if(!player.firstName) player.firstName = newPlayer.name;
     player.lastName = newPlayer.name;
    }
    if(player.lastAuth = newPlayer.auth) player.auth = true;
    if(newPlayer.flair) player.flair = 1 + (newPlayer.flair.x | newPlayer.flair.y << 4);
    if(newPlayer.degree) player.degree = newPlayer.degree;
    if('score' in newPlayer) player.score = newPlayer.score;
    if('points' in newPlayer) player.points = newPlayer.points;
    
    var save = function(field)
    {
     var difference = 0;
     if(field in newPlayer)
     {
      if(newPlayer[field] > player[field] && player.message > 1) // second message of player may contain score recovery after refresh, so ignore first two messages (unless player joined before start)
       difference = newPlayer[field] - player[field];
      player[field] = newPlayer[field];
     }
     return difference;
    };
    
    var pops = save('s-pops'), captures = save('s-captures'), grabs = save('s-grabs'), returns = save('s-returns'), tags = save('s-tags'), powerups = save('s-powerups'), prevent = save('s-prevent'), support = save('s-support');
    if(gameStart == gameStart)
    {
     if(pops && (player.team || newPlayer.team)) expectedSplats[(player.team || newPlayer.team) - 1]++;
     var survive = !pops && (!player.team || !newPlayer.team || newPlayer.team == player.team);
     var newFlag = 'flag' in newPlayer ? newPlayer.flag ? newPlayer.flag : 0 : player.flag;
     var event = new Event(time, survive && newFlag ? 6 : 7);
     if(newPlayer.team && newPlayer.team != player.team)
     {
      if(player.team) event.write(2, 2); // switch
      else event.write(2 | newPlayer.team - 1, 2); // join
      player.team = newPlayer.team;
     }
     else event.write(0, 1); // stay
     event.write(pops ? 1 : 0, 1);
     event.tally(returns);
     event.tally(tags > returns ? tags - returns : 0);
     if(!player.flag) event.write(grabs ? 1 : 0, 1);
     event.tally(captures);
     if('potatoFlag' in newPlayer) player.potato = newPlayer.potatoFlag ? 1 : 0;
     if(survive)
     {
      if((player.flag || grabs) && captures) event.write(newFlag ? 1 : 0, 1); // keep
      if(!player.flag && grabs && newFlag) event.write((newFlag == 3) << 1 | player.potato, 2); // flag
     }
     player.flag = newFlag;
     event.tally(powerups);
     ['grip','bomb','tagpro','speed'].forEach(function(property, index)
     {
      var bit = 1 << index;
      if(player.powers & bit)
      {
       if(property in newPlayer && !newPlayer[property])
       {
        player.powers ^= bit;
        event.write(1, 1); // power down
       }
       else
       {
        event.write(0, 1); // power remains up
        event.emptySize++;
       }
      }
      else if(newPlayer[property])
      {
       if(powerups-- > 0) // should always be true (ignore powerup collection if false)
       {
        player.powers |= bit;
        event.write(1, 1); // power up
        event.emptySize++;
       }
      }
      else if(powerups > 0) event.write(0, 1); // power remains down
     });
     if(!event.empty)
     {
      player.timeline.push(event);
      minTime = time + 1;
     }
     var periodic = function(period, event)
     {
      var array = player.toggles[event];
      var last = array.length - 1;
      var start = Math.max(time - period, gameStart + 1); // do not start period prior to game start
      if(start <= array[last] + 1) // 1 frame error margin
       array[last] = time;
      else
      {
       array.push(start);
       array.push(time);
      }
     };
     if(prevent == 1) periodic(60, 0);
     switch(support)
     {
      case 1: periodic(300, 1); break;
      case 2: periodic(300, 2); break;
      case 3: periodic(300, 1); periodic(300, 2);
     }
    }
    else if(newPlayer.team)
     player.team = player.initialTeam = newPlayer.team;
   }
   
   for(var team = 0; team < 2; team++)
   {
    if(queuedSplats[team].length > expectedSplats[team])
     queuedSplats[team].splice(0, queuedSplats[team].length - expectedSplats[team]);
    if(expectedSplats[team])
    {
     splats[team].tally(queuedSplats[team].length);
     var splat; while(splat = queuedSplats[team].shift())
     {
      splats[team].write(Math.min(Math.max(splat.x + mapGridMargin[0], 0), (1 << mapGridBits[0]) - 1), mapGridBits[0]);
      splats[team].write(Math.min(Math.max(splat.y + mapGridMargin[1], 0), (1 << mapGridBits[1]) - 1), mapGridBits[1]);
     }
    }
   }
  });

  console.log('TagPro Analytics has been initialized.');
 });

// end league mode code

}

// end unprivileged client

} + ')();';
document.body.appendChild(script);
document.body.removeChild(script);

window.addEventListener('beforeunload', function()
{
 var hidden = document.body.dataset.tagproAnalytics;
 if(hidden) GM_setValue('TagProAnalytics', JSON.stringify(JSON.parse(hidden)));
});

})();
