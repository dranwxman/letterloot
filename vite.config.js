<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
<title>LetterLoot Visual Tour</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
body{background:#0a0820;font-family:Georgia,serif;color:#f5f0e8;min-height:100vh;display:flex;align-items:flex-start;justify-content:center;padding:16px;}
.stars{position:fixed;inset:0;pointer-events:none;z-index:0;}
.star{position:absolute;border-radius:50%;background:#fff;}
.wrap{position:relative;z-index:1;width:100%;max-width:380px;display:flex;flex-direction:column;align-items:center;gap:10px;}
.scene-box{width:100%;background:linear-gradient(135deg,#1a1040,#2d1b69);border-radius:24px;padding:20px;border:2px solid rgba(167,139,250,0.5);box-shadow:0 16px 60px rgba(0,0,0,0.8);}
.dots{display:flex;gap:6px;justify-content:center;}
.dot{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,0.2);transition:all 0.3s;cursor:pointer;}
.dot.active{width:20px;background:#a78bfa;}
.dot.done{background:rgba(167,139,250,0.5);}
.scene-title{font-size:16px;font-weight:bold;color:#f6d365;margin-bottom:6px;text-align:center;}
.scene-desc{font-size:13px;color:rgba(255,255,255,0.88);text-align:center;line-height:1.7;margin-bottom:14px;font-weight:bold;}
.nav{display:flex;gap:10px;margin-top:16px;}
.btn-back{flex:1;padding:10px;border-radius:12px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.15);color:rgba(255,255,255,0.5);font-family:Georgia,serif;font-size:12px;cursor:pointer;}
.btn-next{flex:2;padding:12px;border-radius:12px;background:linear-gradient(135deg,#f6d365,#fda085);color:#1a1a2e;font-family:Georgia,serif;font-size:14px;font-weight:bold;border:none;cursor:pointer;}
.btn-done{flex:2;padding:12px;border-radius:12px;background:linear-gradient(135deg,#00c853,#00e676);color:#003300;font-family:Georgia,serif;font-size:14px;font-weight:bold;border:none;cursor:pointer;}
.tile{width:42px;height:48px;border-radius:8px;background:linear-gradient(135deg,rgba(255,255,255,0.15),rgba(255,255,255,0.07));border:1px solid rgba(255,255,255,0.22);display:inline-flex;flex-direction:column;align-items:center;justify-content:center;font-weight:bold;font-size:16px;color:#fff;transition:all 0.2s;position:relative;}
.tv{font-size:7px;color:#fda085;font-weight:bold;}
.tile.sel{background:linear-gradient(135deg,#5c6bc0,#512da8);border-color:#9fa8da;transform:translateY(-5px) scale(1.1);}
.tile.dbl{box-shadow:0 0 12px 3px rgba(255,215,0,0.8);border-color:rgba(255,215,0,0.7);}
.tile.trp{box-shadow:0 0 14px 4px rgba(255,100,255,0.9);border-color:rgba(224,64,251,0.7);}
.tbv{font-size:7px;font-weight:bold;}
.trow{display:flex;gap:5px;justify-content:center;margin-bottom:5px;}
.wbox{width:100%;background:rgba(255,255,255,0.05);border:1.5px solid rgba(255,255,255,0.8);border-radius:8px;padding:8px 12px;min-height:36px;display:flex;align-items:center;gap:6px;margin:8px 0;position:relative;}
.wl{background:linear-gradient(135deg,#5c6bc0,#512da8);border-radius:5px;padding:4px 7px;font-size:14px;font-weight:bold;color:#fff;}
.ws{position:absolute;right:10px;font-size:12px;color:#f6d365;font-weight:bold;}
.finger{position:absolute;font-size:26px;pointer-events:none;z-index:10;transition:left 0.35s ease,top 0.35s ease,opacity 0.3s;opacity:0;}
.flash{position:absolute;top:20%;left:50%;transform:translate(-50%,-50%) scale(0);background:rgba(30,160,70,0.97);border-radius:16px;padding:12px 24px;font-size:18px;font-weight:bold;color:#fff;text-align:center;z-index:20;transition:transform 0.3s cubic-bezier(0.34,1.56,0.64,1);pointer-events:none;white-space:nowrap;}
.flash.show{transform:translate(-50%,-50%) scale(1);}
.dbtn{padding:6px 8px;border-radius:8px;font-size:9px;font-family:Georgia,serif;border:1px solid rgba(255,255,255,0.25);background:rgba(255,255,255,0.08);color:#f0e8d8;cursor:pointer;transition:all 0.2s;white-space:nowrap;display:inline-block;margin:2px;}
.dbtn.hl{border-color:#f6d365;background:rgba(246,211,101,0.2);color:#f6d365;transform:scale(1.08);}
.dbtn.pb{background:linear-gradient(135deg,#f6d365,#fda085);color:#1a1a2e;font-weight:bold;border:none;}
.dbtn.lp{background:rgba(139,92,246,0.22);border:1.5px solid rgba(167,139,250,0.7);color:#e9d5ff;font-weight:bold;}
.callout{background:rgba(246,211,101,0.15);border:1.5px solid rgba(246,211,101,0.6);border-radius:12px;padding:10px 14px;font-size:12px;color:#f6d365;text-align:center;margin-top:10px;line-height:1.6;width:100%;display:none;}
@keyframes rb{0%{color:#f00}16%{color:#f80}33%{color:#ff0}50%{color:#0f0}66%{color:#08f}83%{color:#80f}100%{color:#f00}}
.rb{animation:rb 2s linear infinite;}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(246,211,101,0.7);transform:scale(1)}50%{box-shadow:0 0 0 10px rgba(246,211,101,0);transform:scale(1.04)}}
.btn-next.pulse{animation:pulse 1.2s ease-in-out infinite;}
.btn-done.pulse{animation:pulse 1.2s ease-in-out infinite;}
</style>
</head>
<body>
<div class="stars" id="stars"></div>
<div class="wrap">

  <div class="dots" id="dots"></div>
  <div class="scene-box" id="sb"></div>
</div>
<script>
var sc=document.getElementById("stars");
for(var i=0;i<50;i++){var s=document.createElement("div");s.className="star";var r=Math.random()*1.5+0.5;s.style.cssText="width:"+(r*2)+"px;height:"+(r*2)+"px;opacity:"+(Math.random()*0.4+0.1)+";left:"+(Math.random()*100)+"%;top:"+(Math.random()*100)+"%";sc.appendChild(s);}

var cur=0;

var CL={
  date:"Shows today date -- tiles reset at midnight local time",
  music:"Toggle background guitar music on or off",
  reset:"Resets everything back to Level 1 -- WARNING: you will lose your Perfect Day status and streak bonus!",
  tour:"Replays this visual walkthrough anytime",
  history:"See every word played today, sorted by score",
  stats:"Your scores, streaks, Perfect Days and personal records",
  tips:"Hints and strategies to play smarter",
  leaders:"Global Leaderboard -- Registered players only! Top Scores, Best Words, Longest Words, Perfect Days and Streaks",
  level:"Shows your current level",
  pause:"Stops your timer completely -- use it anytime you need a moment",
  share:"Copy a link to share the game with friends",
  undo:"Reverse your last word for 1,000 pts -- one use per game",
  submit:"Checks your word against the Merriam-Webster dictionary",
  clear:"Removes your tile selection without submitting",
  retry:"Retry the current level with the same tiles -- forfeits Perfect Day",
  buy:"Spend earned points to unlock the next level -- forfeits Perfect Day"
};

function showC(k,el){
  var c=document.getElementById("callout");
  if(!c)return;
  c.style.display="block";
  c.textContent=CL[k]||"";
  document.querySelectorAll(".dbtn").forEach(function(b){b.classList.remove("hl");});
  if(el)el.classList.add("hl");
}

function s1(){
  return "<div style='text-align:center;padding:10px 0'>"
    +"<div style='font-size:72px;margin-bottom:14px'>&#9999;&#65039;</div>"
    +"<div style='font-size:13px;color:#f5f0e8;line-height:1.9'>Every day you get a <strong style='color:#f6d365'>fresh set of tiles</strong>.<br>Every letter has a <strong style='color:#fda085'>point value</strong>.<br>Spell words &middot; Score points &middot; Clear 5 levels<br>for a <strong class='rb'>PERFECT DAY! <svg viewBox='0 0 300 160' width='80' height='50' xmlns='http://www.w3.org/2000/svg' style='vertical-align:-12px;display:inline-block'><path d='M 5 130 A 130 120 0 0 1 185 68' fill='none' stroke='#8B00FF' stroke-width='14' stroke-linecap='round' opacity='0.9'/><path d='M 17 135 A 116 106 0 0 1 181 76' fill='none' stroke='#0055FF' stroke-width='14' stroke-linecap='round' opacity='0.9'/><path d='M 29 140 A 102 92 0 0 1 177 84' fill='none' stroke='#00AA00' stroke-width='14' stroke-linecap='round' opacity='0.9'/><path d='M 41 145 A 88 78 0 0 1 173 92' fill='none' stroke='#FFD700' stroke-width='14' stroke-linecap='round' opacity='0.9'/><path d='M 53 150 A 74 64 0 0 1 169 100' fill='none' stroke='#FF2200' stroke-width='14' stroke-linecap='round' opacity='0.9'/><path d='M 179 158 Q 179 132 215 132 Q 251 132 251 158 Z' fill='#111111'/><rect x='179' y='130' width='72' height='28' fill='#111111'/><ellipse cx='215' cy='158' rx='36' ry='9' fill='#111111' stroke='#666' stroke-width='1.5'/><ellipse cx='215' cy='130' rx='36' ry='11' fill='#333333' stroke='#888' stroke-width='2'/><ellipse cx='215' cy='128' rx='30' ry='7' fill='#444444'/><ellipse cx='205' cy='123' rx='11' ry='5' fill='#CC9900' stroke='#FFD700' stroke-width='1.5'/><ellipse cx='225' cy='123' rx='11' ry='5' fill='#CC9900' stroke='#FFD700' stroke-width='1.5'/><ellipse cx='215' cy='118' rx='12' ry='5.5' fill='#DDAA00' stroke='#FFE044' stroke-width='1.5'/><ellipse cx='209' cy='124' rx='11' ry='5' fill='#DDAA00' stroke='#FFE044' stroke-width='1.5'/><ellipse cx='221' cy='124' rx='11' ry='5' fill='#DDAA00' stroke='#FFE044' stroke-width='1.5'/><ellipse cx='215' cy='119' rx='13' ry='6' fill='#FFD700' stroke='#FFEE88' stroke-width='2'/><text x='215' y='122' text-anchor='middle' font-family='Georgia,serif' font-size='7' font-weight='bold' fill='#5a3a00'>LL</text><text x='250' y='118' font-family='Georgia,serif' font-size='10' fill='#FFD700'>&#10022;</text><text x='174' y='122' font-family='Georgia,serif' font-size='8' fill='#FFD700' opacity='0.9'>&#10022;</text></svg></strong></div>"
    +"<div style='margin-top:16px;background:rgba(255,255,255,0.06);border-radius:12px;padding:14px;font-size:11px;color:rgba(255,255,255,0.6);line-height:1.8'>&#10022; Same tiles for every player worldwide<br>&#10022; Resets at midnight your local time<br>&#10022; Compete on the Global Leaderboard</div>"
    +"</div>";
}

function s2(){
  return "<div style='position:relative'>"
    +"<div id='board' style='margin:0 auto 6px'>"
    // Row 1: Q . . . E
    +"<div class='trow'>"
    +"<div class='tile' id='tQ'>Q<span class='tv'>20</span></div>"
    +"<div class='tile' id='tR1'>R<span class='tv'>5</span></div>"
    +"<div class='tile dbl' id='tA1'>A<span class='tbv' style='color:#ffd700'>2x</span></div>"
    +"<div class='tile' id='tN1'>N<span class='tv'>4</span></div>"
    +"<div class='tile' id='tE'>E<span class='tv'>3</span></div>"
    +"</div>"
    // Row 2: . . . . .
    +"<div class='trow'>"
    +"<div class='tile' id='tL1'>L<span class='tv'>6</span></div>"
    +"<div class='tile trp' id='tB1'>B<span class='tbv' style='color:#e040fb'>3x</span></div>"
    +"<div class='tile' id='tS1'>S<span class='tv'>5</span></div>"
    +"<div class='tile' id='tM1'>M<span class='tv'>7</span></div>"
    +"<div class='tile' id='tD1'>D<span class='tv'>6</span></div>"
    +"</div>"
    // Row 3: . U . . .
    +"<div class='trow'>"
    +"<div class='tile' id='tF1'>F<span class='tv'>8</span></div>"
    +"<div class='tile' id='tU'>U<span class='tv'>7</span></div>"
    +"<div class='tile' id='tH1'>H<span class='tv'>6</span></div>"
    +"<div class='tile' id='tW1'>W<span class='tv'>9</span></div>"
    +"<div class='tile' id='tO1'>O<span class='tv'>4</span></div>"
    +"</div>"
    // Row 4: . . I . T
    +"<div class='trow'>"
    +"<div class='tile' id='tP1'>P<span class='tv'>8</span></div>"
    +"<div class='tile' id='tV1'>V<span class='tv'>11</span></div>"
    +"<div class='tile' id='tI'>I<span class='tv'>4</span></div>"
    +"<div class='tile' id='tK1'>K<span class='tv'>12</span></div>"
    +"<div class='tile' id='tT'>T<span class='tv'>3</span></div>"
    +"</div>"
    +"</div>"
    +"<div class='finger' id='fg'>&#128070;</div>"
    +"<div class='wbox' id='wb'><span style='color:rgba(255,255,255,0.3);font-size:11px;font-style:italic'>Tap tiles to build a word...</span></div>"
    +"<div style='display:flex;gap:6px;margin:0 0 6px'><div id='submitbtn' style='flex:2;padding:7px;border-radius:8px;background:rgba(246,211,101,0.15);border:1px solid rgba(246,211,101,0.4);color:#f6d365;font-size:10px;font-weight:bold;text-align:center;transition:transform 0.15s,background 0.2s'>Submit Word</div><div id='cbtn' style='flex:1;padding:7px;border-radius:8px;background:rgba(192,132,252,0.2);border:2px solid rgba(216,180,254,0.8);color:#ede9fe;font-size:10px;font-weight:bold;text-align:center;transition:background 0.2s'>&#10005; Clear</div></div>"+"<div style='font-size:10px;color:rgba(255,255,255,0.5);text-align:center'>Tiles can be anywhere on the board -- no adjacency needed!</div>"
    +"</div>";
}

function a2(){
  var wrong=["Q","I","U","E"];
  var wrongIds=["tQ","tI","tU","tE"];
  var correct=["Q","U","I","E","T"];
  var correctIds=["tQ","tU","tI","tE","tT"];
  var scores={Q:20,U:7,I:4,E:3,T:3};
  var step=0;
  var word=[];

  function getTileCenter(id){
    var el=document.getElementById(id);
    var board=document.getElementById("board");
    if(!el||!board)return{x:0,y:0};
    var er=el.getBoundingClientRect();
    var br=board.getBoundingClientRect();
    return{x:er.left-br.left+er.width/2-16, y:er.top-br.top+er.height/2-10};
  }

  function getClearBtnPos(){
    var cb=document.getElementById("cbtn");
    var board=document.getElementById("board");
    if(!cb||!board)return{x:120,y:110};
    var cr=cb.getBoundingClientRect();
    var br=board.getBoundingClientRect();
    return{x:cr.left-br.left+cr.width/2-14, y:cr.top-br.top+cr.height/2-4};
  }

  function updateWordBox(){
    var wb=document.getElementById("wb");
    if(!wb)return;
    if(word.length===0){
      wb.innerHTML="<span style='color:rgba(255,255,255,0.3);font-size:11px;font-style:italic'>Tap tiles to build a word...</span>";
      return;
    }
    var total=word.reduce(function(a,l){return a+(scores[l]||0);},0);
    wb.innerHTML=word.map(function(l){return "<span class='wl'>"+l+"</span>";}).join("")+"<span class='ws'>+"+total+" pts</span>";
  }

  function moveFinger(pos, cb, moveDuration, waitAfter){
    var fg=document.getElementById("fg");
    if(!fg)return;
    fg.style.transition="left "+moveDuration+"ms cubic-bezier(0.4,0,0.2,1), top "+moveDuration+"ms cubic-bezier(0.4,0,0.2,1), opacity 0.3s, font-size 0.3s";
    fg.style.opacity="1";
    fg.style.left=pos.x+"px";
    fg.style.top=pos.y+"px";
    setTimeout(cb, moveDuration+(waitAfter||150));
  }

  function tapTile(id, letter){
    var el=document.getElementById(id);
    if(el){
      el.classList.add("sel");
      el.style.transition="transform 0.15s";
    }
    word.push(letter);
    updateWordBox();
  }

  function spellWrong(){
    if(step>=wrong.length){
      step=0;
      setTimeout(pauseThenClear, 780);
      return;
    }
    moveFinger(getTileCenter(wrongIds[step]), function(){
      tapTile(wrongIds[step], wrong[step]);
      step++;
      setTimeout(spellWrong, 650);
    }, 450, 150);
  }

  function pauseThenClear(){
    // Grow finger bigger to signal "watch this"
    var fg=document.getElementById("fg");
    if(fg){fg.style.fontSize="36px";}
    setTimeout(function(){
      // Slowly glide to Clear button
      moveFinger(getClearBtnPos(), function(){
        // Tap Clear with visible press
        var cb=document.getElementById("cbtn");
        if(cb){
          cb.style.transition="background 0.2s, transform 0.15s";
          cb.style.background="rgba(216,180,254,0.75)";
          cb.style.transform="scale(0.9)";
          setTimeout(function(){
            if(cb){cb.style.background="";cb.style.transform="";}
            document.querySelectorAll(".tile.sel").forEach(function(t){t.classList.remove("sel");});
            word=[];
            updateWordBox();
            // Shrink finger back to normal
            if(fg)fg.style.fontSize="26px";
            setTimeout(spellCorrect, 650);
          }, 500);
        }
      }, 585, 130);
    }, 400);
  }

  function spellCorrect(){
    if(step>=correct.length){
      var fg=document.getElementById("fg");
      if(fg){
        var sb=document.getElementById("submitbtn");
        if(sb){
          // Get positions relative to viewport then offset to finger container
          var sr=sb.getBoundingClientRect();
          var pr=fg.parentElement.getBoundingClientRect();
          fg.style.transition="left 0.5s ease, top 0.5s ease, opacity 0.3s";
          fg.style.left=(sr.left-pr.left+sr.width/2-14)+"px";
          fg.style.top=(sr.top-pr.top+sr.height/2-4)+"px";
          setTimeout(function(){
            // Tap animation on submit button
            sb.style.transition="transform 0.12s, background 0.2s";
            sb.style.transform="scale(0.92)";
            sb.style.background="rgba(246,211,101,0.45)";
            setTimeout(function(){
              sb.style.transform="";
              sb.style.background="";
              fg.style.opacity="0";
              // Flash score in word box
              var wb=document.getElementById("wb");
              if(wb){
                wb.style.borderColor="#22d3ee";
                wb.innerHTML="<span class='wl'>Q</span><span class='wl'>U</span><span class='wl'>I</span><span class='wl'>E</span><span class='wl'>T</span>"
                  +"<span style='position:absolute;right:8px;color:#22d3ee;font-size:13px;font-weight:bold'>&#10003; +37 pts!</span>";
              }
              flashNext();
            }, 200);
          }, 500);
        } else {
          fg.style.opacity="0";
          flashNext();
        }
      }
      return;
    }
    moveFinger(getTileCenter(correctIds[step]), function(){
      tapTile(correctIds[step], correct[step]);
      step++;
      setTimeout(spellCorrect, 490);
    }, 247, 98);
  }

  setTimeout(spellWrong, 585);
}

function s3(){
  return "<div style='position:relative'>"
    +"<div class='wbox' style='border-color:#f6d365'>"
    +"<span class='wl'>Q</span><span class='wl'>U</span><span class='wl'>I</span><span class='wl'>E</span><span class='wl'>T</span>"
    +"<span class='ws'>+37 pts</span>"
    +"</div>"
    +"<div style='display:flex;gap:6px;margin:8px 0'>"
    +"<div id='sbtn' style='flex:2;padding:10px;border-radius:9px;background:linear-gradient(135deg,#f6d365,#fda085);color:#1a1a2e;font-size:12px;font-weight:bold;text-align:center;cursor:pointer;font-family:Georgia,serif;transition:transform 0.1s'>Submit Word</div>"
    +"<div style='flex:1;padding:10px;border-radius:9px;background:rgba(192,132,252,0.25);border:2px solid rgba(216,180,254,0.95);color:#ede9fe;font-size:10px;font-weight:bold;text-align:center'>Clear</div>"
    +"</div>"
    +"<div class='flash' id='flash'>QUIET &#10003;<br><span style='font-size:14px'>+37 pts</span></div>"
    +"<div style='margin-top:8px;background:rgba(255,255,255,0.06);border-radius:12px;padding:12px;font-size:11px;color:rgba(255,255,255,0.7);line-height:1.8;text-align:center'>"
    +"Words checked against<br><strong style='color:#f6d365'>Merriam-Webster Dictionary</strong><br>Collegiate + Medical editions"
    +"</div>"
    +"<div class='finger' id='fg2' style='bottom:130px;left:calc(33% - 14px)'>&#128070;</div>"
    +"</div>";
}

function a3(){
  var fg=document.getElementById("fg2");
  var btn=document.getElementById("submitbtn");
  var fl=document.getElementById("flash");
  if(!fg||!btn||!fl)return;
  setTimeout(function(){
    fg.style.opacity="1";
    setTimeout(function(){
      fg.style.opacity="0";
      btn.style.transform="scale(0.93)";
      setTimeout(function(){
        btn.style.transform="scale(1)";
        fl.classList.add("show");
        setTimeout(function(){fl.classList.remove("show");flashNext();},2200);
      },150);
    },455);
  },500);
}

function s4(){
  return "<div>"
    +"<div style='margin-bottom:10px;text-align:center'>"
    +"<div style='font-size:12px;color:rgba(255,255,255,0.85);margin-bottom:8px;font-weight:bold'>Rare letters score big!</div>"
    +"<div style='display:flex;gap:6px;justify-content:center'>"
    +"<div class='tile' style='width:44px;height:50px;font-size:16px'>Z<span class='tv'>22</span></div>"
    +"<div class='tile' style='width:44px;height:50px;font-size:16px'>J<span class='tv'>16</span></div>"
    +"<div class='tile' style='width:44px;height:50px;font-size:16px'>K<span class='tv'>12</span></div>"
    +"<div class='tile' style='width:44px;height:50px;font-size:16px'>X<span class='tv'>14</span></div>"
    +"</div></div>"
    +"<div style='font-size:12px;color:rgba(255,255,255,0.85);text-align:center;margin-bottom:6px;font-weight:bold'>Bonus tiles multiply your score!</div>"
    +"<div style='display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px'>"
    +"<div style='background:rgba(255,215,0,0.08);border:1px solid rgba(255,215,0,0.4);border-radius:10px;padding:10px;text-align:center'><div class='tile dbl' style='width:40px;height:46px;font-size:15px;margin:0 auto 6px'>B<span class='tbv' style='color:#ffd700'>2x</span></div><div style='font-size:10px;color:#ffd700'>Gold = 2x letter value</div></div>"
    +"<div style='background:rgba(224,64,251,0.08);border:1px solid rgba(224,64,251,0.4);border-radius:10px;padding:10px;text-align:center'><div class='tile trp' style='width:40px;height:46px;font-size:15px;margin:0 auto 6px'>V<span class='tbv' style='color:#e040fb'>3x</span></div><div style='font-size:10px;color:#e040fb'>Purple = 3x letter value</div></div>"
    +"</div>"
    +"<div style='background:rgba(110,231,183,0.08);border:1px solid rgba(110,231,183,0.3);border-radius:10px;padding:8px;text-align:center;font-size:11px;color:#6ee7b7'>&#128161; Spell 8+ letter words for long-word bonuses!</div>"
    +"<div style='margin-top:6px;background:rgba(255,255,255,0.06);border-radius:10px;padding:8px;text-align:center;font-size:11px;color:rgba(255,255,255,0.85);line-height:1.6'>Words checked against<br><strong style='color:#f6d365'>Merriam-Webster Dictionary</strong><br>Collegiate + Medical editions</div>"
    +"</div>";
}

function s5(){
  return "<div><div style='font-size:16px;font-weight:bold;color:#f6d365;text-align:center;margin-bottom:12px;letter-spacing:1px'>&#128073; Tap any button to learn what it does!</div><div style='font-size:9px;color:rgba(255,255,255,0.4);letter-spacing:2px;margin-bottom:4px'>TOP ROW</div><div style='margin-bottom:8px'><span class='dbtn' onclick='showC(\"date\",this)'>&#128197; Date</span><span class='dbtn' onclick='showC(\"music\",this)' style='background:rgba(255,255,255,0.15);border:1.5px solid rgba(255,255,255,0.6);color:#ffffff;font-size:11px'>&#9835; Music</span><span class='dbtn' onclick='showC(\"reset\",this)'>&#8634; Reset Full Game</span><span class='dbtn' onclick='showC(\"tour\",this)'>&#8634; Tour</span></div><div style='font-size:9px;color:rgba(255,255,255,0.4);letter-spacing:2px;margin-bottom:4px'>NAV TABS</div><div style='margin-bottom:8px'><span class='dbtn' onclick='showC(\"history\",this)'>&#128220; History</span><span class='dbtn' onclick='showC(\"stats\",this)'>&#128202; Stats</span><span class='dbtn' onclick='showC(\"tips\",this)'>&#8505;&#65039; Tips</span><span class='dbtn' onclick='showC(\"leaders\",this)'>&#127942; Leaders</span><span class='dbtn lp' onclick='showC(\"level\",this)'>&#10022; L1 &#10022;</span></div><div style='font-size:9px;color:rgba(255,255,255,0.4);letter-spacing:2px;margin-bottom:4px'>GAME CONTROLS</div><div style='margin-bottom:4px'><span class='dbtn' onclick='showC(\"pause\",this)'>&#9208;&#65039; Pause</span><span class='dbtn' onclick='showC(\"share\",this)'>&#128228; Share LetterLoot</span><span class='dbtn' onclick='showC(\"undo\",this)'>&#8617;&#65039; UNDO last word</span></div><div><span class='dbtn pb' onclick='showC(\"submit\",this)'>Submit Word</span><span class='dbtn' onclick='showC(\"clear\",this)'>&#10005; Clear</span><span class='dbtn' onclick='showC(\"retry\",this)'>&#128260; Replay L1</span><span class='dbtn' onclick='showC(\"buy\",this)'>&#128275; Buy L2</span></div><div class='callout' id='callout'></div></div>";
}

function s6(){
  var lvls=[{l:1,t:42,b:100,c:"#6ee7b7"},{l:2,t:48,b:200,c:"#60a5fa"},{l:3,t:54,b:300,c:"#a78bfa"},{l:4,t:60,b:400,c:"#fda085"},{l:5,t:66,b:500,c:"#f6d365"}];
  var html="<div style='display:flex;flex-direction:column;gap:7px'>";
  for(var i=0;i<lvls.length;i++){
    var lv=lvls[i];
    html+="<div style='display:flex;align-items:center;gap:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:9px 12px'>";
    html+="<div style='font-size:15px;font-weight:bold;color:"+lv.c+";min-width:22px'>L"+lv.l+"</div>";
    html+="<div style='flex:1'><div style='font-size:11px;color:#f5f0e8;font-weight:bold'>"+lv.t+" tiles</div><div style='font-size:9px;color:rgba(255,255,255,0.4);margin-top:2px'>Clear all for +"+lv.b+" bonus pts</div></div>";
    html+="<div style='background:rgba(255,255,255,0.06);border-radius:6px;padding:3px 8px;font-size:9px;color:"+lv.c+"'>+"+lv.b+"</div></div>";
  }
  html+="<div style='text-align:center;font-size:11px;color:rgba(255,255,255,0.5);margin-top:4px'>Stuck? <span style='color:#fda085'>Buy next level</span> with points or <span style='color:#60a5fa'>Replay</span> same tiles</div></div>";
  return html;
}

function s7(){
  var bigPot="<div style='display:flex;justify-content:center;margin:8px 0'>"+"<svg viewBox='0 0 300 160' width='220' height='118' xmlns='http://www.w3.org/2000/svg'>"+"<path d='M 10 140 A 160 150 0 0 1 200 80' fill='none' stroke='#8B00FF' stroke-width='13' stroke-linecap='round' opacity='0.9'/>"+"<path d='M 20 143 A 147 137 0 0 1 197 86' fill='none' stroke='#4400CC' stroke-width='13' stroke-linecap='round' opacity='0.9'/>"+"<path d='M 30 146 A 134 124 0 0 1 194 92' fill='none' stroke='#0055FF' stroke-width='13' stroke-linecap='round' opacity='0.9'/>"+"<path d='M 40 149 A 121 111 0 0 1 191 98' fill='none' stroke='#00AA00' stroke-width='13' stroke-linecap='round' opacity='0.9'/>"+"<path d='M 50 152 A 108 98 0 0 1 188 104' fill='none' stroke='#FFD700' stroke-width='13' stroke-linecap='round' opacity='0.9'/>"+"<path d='M 60 155 A 95 85 0 0 1 185 110' fill='none' stroke='#FF8C00' stroke-width='13' stroke-linecap='round' opacity='0.9'/>"+"<path d='M 70 158 A 82 72 0 0 1 182 116' fill='none' stroke='#FF2200' stroke-width='13' stroke-linecap='round' opacity='0.9'/>"+"<path d='M 172 158 Q 172 132 200 132 Q 228 132 228 158 Z' fill='#111'/>"+"<rect x='172' y='130' width='56' height='28' fill='#111'/>"+"<ellipse cx='200' cy='158' rx='28' ry='8' fill='#111' stroke='#666' stroke-width='1.5'/>"+"<ellipse cx='200' cy='130' rx='28' ry='9' fill='#333' stroke='#888' stroke-width='2'/>"+"<ellipse cx='191' cy='123' rx='10' ry='5' fill='#CC9900' stroke='#FFD700' stroke-width='1.5'/>"+"<ellipse cx='209' cy='123' rx='10' ry='5' fill='#CC9900' stroke='#FFD700' stroke-width='1.5'/>"+"<ellipse cx='200' cy='119' rx='12' ry='6' fill='#FFD700' stroke='#FFEE88' stroke-width='2'/>"+"<text x='200' y='122' text-anchor='middle' font-family='Georgia,serif' font-size='6' font-weight='bold' fill='#5a3a00'>LL</text>"+"<text x='228' y='119' font-family='Georgia,serif' font-size='10' fill='#FFD700' opacity='0.9'>&#10022;</text>"+"<text x='166' y='122' font-family='Georgia,serif' font-size='8' fill='#FFD700' opacity='0.8'>&#10022;</text>"+"</svg></div>";
  return "<div style='text-align:center'>"
    +bigPot
    +"<div style='background:rgba(255,255,255,0.07);border:1.5px solid rgba(255,255,255,0.2);border-radius:14px;padding:14px;font-size:13px;color:#f5f0e8;line-height:2.1;text-align:left'>"
    +"&#10024; Clear all 5 levels without buying or repeating<br>"
    +"<svg viewBox='0 0 300 160' width='36' height='22' xmlns='http://www.w3.org/2000/svg' style='vertical-align:-5px;display:inline-block'><path d='M 5 130 A 130 120 0 0 1 185 68' fill='none' stroke='#8B00FF' stroke-width='18' stroke-linecap='round' opacity='0.9'/><path d='M 22 137 A 108 98 0 0 1 178 84' fill='none' stroke='#00AA00' stroke-width='18' stroke-linecap='round' opacity='0.9'/><path d='M 39 144 A 86 76 0 0 1 171 100' fill='none' stroke='#FF2200' stroke-width='18' stroke-linecap='round' opacity='0.9'/><path d='M 175 158 Q 175 133 210 133 Q 245 133 245 158 Z' fill='#111'/><rect x='175' y='131' width='70' height='27' fill='#111'/><ellipse cx='210' cy='131' rx='35' ry='10' fill='#333' stroke='#888' stroke-width='2'/><ellipse cx='210' cy='120' rx='13' ry='6' fill='#FFD700' stroke='#FFEE88' stroke-width='1.5'/><text x='210' y='123' text-anchor='middle' font-family='Georgia,serif' font-size='7' font-weight='bold' fill='#5a3a00'>LL</text></svg> Experience a <strong>PERFECT DAY</strong><br>"
    +"&#127881; Big Bonuses at the end of the Rainbow!"
    +"</div>"
    +"<div style='margin-top:10px;background:rgba(246,211,101,0.1);border:1px solid rgba(246,211,101,0.4);border-radius:12px;padding:10px;font-size:12px;color:rgba(255,255,255,0.75);line-height:1.7'>"
    +"Score a Perfect Day to find out what's waiting...<br>"
    +"<strong style='color:#f6d365'>Perfect Day streaks earn increasingly large bonuses!</strong>"
    +"</div>"
    +"</div>";
}

function s8(){
  return "<div style='text-align:center;padding:8px 0'>"
    +"<div style='font-size:48px;margin-bottom:6px'>&#9999;&#65039;</div>"
    +"<div style='font-size:13px;color:#f5f0e8;line-height:1.9;margin-bottom:10px'>"
    +"Tap <strong style='color:#f6d365'>any tiles</strong> to build words<br>"
    +"<strong style='color:#fda085'>Score big</strong> with rare letters and bonus tiles<br>"
    +"Compete on the <strong style='color:#a78bfa'>Global Leaderboard</strong>"
    +"</div>"
    +"<div style='display:flex;justify-content:center;margin:6px 0'><svg viewBox='0 0 300 160' width='200' height='107' xmlns='http://www.w3.org/2000/svg'><path d='M 10 140 A 160 150 0 0 1 200 80' fill='none' stroke='#8B00FF' stroke-width='13' stroke-linecap='round' opacity='0.9'/><path d='M 20 143 A 147 137 0 0 1 197 86' fill='none' stroke='#4400CC' stroke-width='13' stroke-linecap='round' opacity='0.9'/><path d='M 30 146 A 134 124 0 0 1 194 92' fill='none' stroke='#0055FF' stroke-width='13' stroke-linecap='round' opacity='0.9'/><path d='M 40 149 A 121 111 0 0 1 191 98' fill='none' stroke='#00AA00' stroke-width='13' stroke-linecap='round' opacity='0.9'/><path d='M 50 152 A 108 98 0 0 1 188 104' fill='none' stroke='#FFD700' stroke-width='13' stroke-linecap='round' opacity='0.9'/><path d='M 60 155 A 95 85 0 0 1 185 110' fill='none' stroke='#FF8C00' stroke-width='13' stroke-linecap='round' opacity='0.9'/><path d='M 70 158 A 82 72 0 0 1 182 116' fill='none' stroke='#FF2200' stroke-width='13' stroke-linecap='round' opacity='0.9'/><path d='M 172 158 Q 172 132 200 132 Q 228 132 228 158 Z' fill='#111'/><rect x='172' y='130' width='56' height='28' fill='#111'/><ellipse cx='200' cy='158' rx='28' ry='8' fill='#111' stroke='#666' stroke-width='1.5'/><ellipse cx='200' cy='130' rx='28' ry='9' fill='#333' stroke='#888' stroke-width='2'/><ellipse cx='191' cy='123' rx='10' ry='5' fill='#CC9900' stroke='#FFD700' stroke-width='1.5'/><ellipse cx='209' cy='123' rx='10' ry='5' fill='#CC9900' stroke='#FFD700' stroke-width='1.5'/><ellipse cx='200' cy='119' rx='12' ry='6' fill='#FFD700' stroke='#FFEE88' stroke-width='2'/><text x='200' y='122' text-anchor='middle' font-family='Georgia,serif' font-size='6' font-weight='bold' fill='#5a3a00'>LL</text><text x='228' y='119' font-family='Georgia,serif' font-size='10' fill='#FFD700' opacity='0.9'>&#10022;</text><text x='166' y='122' font-family='Georgia,serif' font-size='8' fill='#FFD700' opacity='0.8'>&#10022;</text></svg></div>"
    +"<div style='background:rgba(246,211,101,0.1);border:1px solid rgba(246,211,101,0.3);border-radius:14px;padding:12px;font-size:12px;color:rgba(255,255,255,0.7);line-height:1.7'>"
    +"&#128161; Tap <strong style='color:#f6d365;font-size:13px'>&#8634; TOUR</strong> anytime to replay this walkthrough!"
    +"</div>"
    +"<div style='margin-top:10px;text-align:center'>"
    +"<span onclick='goTo(0)' style='display:inline-block;padding:7px 20px;border-radius:10px;background:linear-gradient(135deg,rgba(246,211,101,0.2),rgba(253,160,133,0.15));border:1.5px solid rgba(246,211,101,0.6);color:#f6d365;font-size:12px;font-weight:bold;cursor:pointer;font-family:Georgia,serif;letter-spacing:1px'>&#8634; TOUR</span>"
    +"</div>"
    +"</div>";
}

var SCENES=[
  {title:"Welcome to LetterLoot!",desc:"A daily word puzzle where every letter has a point value.",fn:s1,enter:null,last:false},
  {title:"Tap Tiles to Spell a Word",desc:"Tap any tiles in any order -- no adjacency rules! Watch the demo:",fn:s2,enter:a2,last:false},
  {title:"Letter Values",desc:"Every letter has value.",fn:s4,enter:null,last:false},
  {title:"Your Buttons",desc:"",fn:s5,enter:null,last:false},
  {title:"5 Levels of Looting",desc:"Each level has more tiles. Clear the board for a bonus!",fn:s6,enter:null,last:false},
  {title:"The Perfect Day",desc:"Find the Pot of Loot at the end of the Rainbow!",fn:s7,enter:null,last:false},
  {title:"Ready to Loot!",desc:"You have everything you need. Now go get that loot!",fn:s8,enter:null,last:true}
];

function flashNext(){
  setTimeout(function(){
    var btn=document.querySelector(".btn-next")||document.querySelector(".btn-done");
    if(btn)btn.classList.add("pulse");
  }, 200);
}

function render(){
  var scene=SCENES[cur];
  var dotsEl=document.getElementById("dots");
  var dhtml="";
  for(var i=0;i<SCENES.length;i++){
    var cls="dot"+(i===cur?" active":i<cur?" done":"");
    dhtml+="<div class=\""+cls+"\" onclick=\"goTo("+i+")\"></div>";
  }
  dotsEl.innerHTML=dhtml;
  var box=document.getElementById("sb");
  var backLabel=cur===0?"Skip":"Back";
  box.innerHTML="<div class=\"scene-title\">"+scene.title+"</div>"
    +"<div class=\"scene-desc\">"+scene.desc+"</div>"
    +scene.fn()
    +"<div class=\"nav\">"
    +"<button class=\"btn-back\" onclick=\"back()\">"+backLabel+"</button>"
    +(scene.last?"<button class=\"btn-done\" onclick=\"done()\">&#9999;&#65039; Lets Play!</button>":"<button class=\"btn-next\" onclick=\"next()\">Next &rarr;</button>")
    +"</div>";
  if(scene.enter)setTimeout(scene.enter,150);
  else flashNext();
}

function next(){if(cur<SCENES.length-1){cur++;render();}}
function back(){if(cur>0){cur--;render();}else{done();}}
function goTo(i){cur=i;render();}
function done(){try{window.parent.postMessage("tour-done","*");}catch(e){}}

render();
</script>
</body>
</html>
