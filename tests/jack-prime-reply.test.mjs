import test from 'node:test';
import assert from 'node:assert/strict';
import {instantReply,taskReply,shortReply} from '../lib/jack-prime-reply.js';

test('drops extra sentences, including lower-case follow-ups and extra paragraphs',()=>{
  assert.equal(shortReply('Start with cybertruck. it got hooks. then try the album. More info here.'),'Start with cybertruck. it got hooks.');
  assert.equal(shortReply('Start here.\n\nThen try the album.\n\nOne more thing.'),'Start here. Then try the album.');
});

test('preserves short answers, links, and title abbreviations',()=>{
  for(const text of ["Jack Prime—what's good?",'**#jacksandersuperstar®**',"Try **step on them (ft. o1sea)**. It's on /jacksandersuperstar."]){
    assert.equal(shortReply(text),text);
  }
});

test('keeps bold emphasis balanced when cutting after the second sentence',()=>{
  assert.equal(shortReply('First sentence. **Second sentence.** Third sentence.'),'First sentence. **Second sentence.**');
  assert.equal(shortReply('First sentence. __Second sentence.__ Third sentence.'),'First sentence. __Second sentence.__');
});

test('omits an unfinished second sentence when the model hits its token limit',()=>{
  assert.equal(shortReply('Start with **cybertruck**. Then you could try the','length'),'Start with **cybertruck**.');
  assert.equal(shortReply('**Start with the','length'),'**Start with…**');
});

test('keeps greeting and acknowledgment replies casual even with old check-in history',()=>{
  assert.equal(shortReply("bet. What's good with you?",'stop','Fine'),'bet.');
  assert.equal(shortReply("How you doing? What's on your mind today?",'stop','Hiiii'),'yo.');
  assert.equal(shortReply('yo, how are you!','stop','hey'),'yo.');
  assert.equal(shortReply('hey, how’s it going!','stop','Hiiii'),'yo.');
  assert.equal(shortReply('how you been.','stop','Fine'),'bet.');
  assert.equal(shortReply("what’s good.",'stop','Fine'),'bet.');
  assert.equal(shortReply('Hiiii!!! How are you?','stop','Hiiii'),'hi.');
  assert.equal(shortReply('Got you. What else do you need?','stop',' thank   you! '),'Got you.');
});

test('preserves answers and useful questions for substantive or combined messages',()=>{
  const text='Do you want the album or a single? That changes my pick.';
  for(const input of ['hi, what should I listen to?','fine?','sure','yes','How do you write a hook?']){
    assert.equal(shortReply(text,'stop',input),text);
  }
  assert.equal(shortReply('**cybertruck** got hooks. Check /cybertruck.','stop','What song should I play?'),'**cybertruck** got hooks. Check /cybertruck.');
});

test('instant replies cover only simple social turns, never meaningful questions or offers',()=>{
  assert.equal(instantReply('Hiiii'),'yo.');
  assert.equal(instantReply(' Fine! '),'bet.');
  for(const input of ['hi, what should I listen to?','fine?','yes','sure','alright','What do you think?','thanks, but where is the merch?']){
    assert.equal(instantReply(input),null);
  }
});

test('math and essay tasks are declined without producing the requested work',()=>{
  for(const input of ["What's 2 + 2?",'What is two times four?',"What's 9-2?",'9 - 2','Solve x^2 + 2x = 6','Help with my algebra homework','Explain the Pythagorean theorem','Can you do my math?']){
    assert.equal(taskReply(input),"i don't do math problems. ask me about Jack.");
  }
  for(const input of ['Write an essay about Jack','Can you do my history essay?','Write a 500-word biography of Jack','Draft a research paper on music']){
    assert.equal(taskReply(input),"i don't write essays. i can keep it short about Jack, though.");
  }
});

test('ordinary Jack questions, dates, counts, prices, and creative conversation stay available',()=>{
  for(const input of ['Who is Jack Sander?','When did prodigy genius come out?','How many tracks are on Jack’s album?','How much is a superstar tee?','What does Jack write about?','I don’t want an essay. Who is Jack?','What is Jack’s birthday?','What did Jack release in 2020-2026?','What album came out on 7/15/2026?','What did Jack release on 2026-07-15?','Does Jack write essays?','Does Jack like algebra?','Give me a hot take.','Make a poster for Jack']){
    assert.equal(taskReply(input),null,input);
  }
});

test('formal unknown-fact responses become casual without discarding real answers',()=>{
  for(const text of ["I don't have Jack's favorite brother confirmed.","I don’t have his birthday confirmed.","I don't have that information.","That information isn't publicly available.","I can't confirm that."]){
    assert.equal(shortReply(text),'ion know',text);
  }
  for(const text of ["the cologne's $50, 30 mL.","ion know yet", "I don't know shipping costs. The tee is $25."]){
    assert.equal(shortReply(text),text);
  }
});
