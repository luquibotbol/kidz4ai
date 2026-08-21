// Stands in for the OpenAI API during tests. Routes on the system prompt.
const http = require('http');
const MISSION = JSON.stringify({
  title: "Sell ten stickers at school",
  why: "You already sell there, so distribution is solved.",
  steps: ["Pick one niche your school is into","Make 8 designs with AI","Order 30 stickers","Sell them for $4"],
  stuck: "Around day 2 the print file comes back the wrong size and you redo the bleed.",
  done: "Cash in your hand from someone you're not related to."
});
let discoveryTurn = 0;
http.createServer((req, res) => {
  let raw = '';
  req.on('data', c => raw += c);
  req.on('end', () => {
    let sys = '';
    try { sys = JSON.parse(raw).messages[0].content; } catch {}
    let content;
    if (sys.includes('You generate the next mission')) content = MISSION;
    else if (sys.includes('PHASE 3 — DAY RECONSTRUCTION')) {
      discoveryTurn++;
      content = discoveryTurn === 1
        ? "Before we start. Nobody reads this but me, and I'm software. Ready?"
        : "WHAT I ACTUALLY SAW\nYou spent four hours in the mod files yesterday.\n\nTHE BET\nMechanical stuff, real ones.\n[[PLAN_COMPLETE]]";
    } else content = "What's it doing that you don't want it to do?";
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({
      id:'chatcmpl-mock', object:'chat.completion', created:Date.now(), model:'gpt-4o',
      choices:[{index:0, message:{role:'assistant', content}, finish_reason:'stop'}],
      usage:{prompt_tokens:1, completion_tokens:1, total_tokens:2}
    }));
  });
}).listen(3200, () => console.log('mock openai on :3200'));
