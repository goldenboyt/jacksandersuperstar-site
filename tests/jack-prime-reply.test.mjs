import test from 'node:test';
import assert from 'node:assert/strict';
import {shortReply} from '../lib/jack-prime-reply.js';

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
