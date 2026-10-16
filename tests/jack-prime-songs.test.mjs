import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveSongMentions} from '../lib/jack-prime-songs.js';

const song=(releasePage,trackIndex)=>({releasePage,trackIndex});
const album=song('/jacksandersuperstar',0);
const apple='https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/test.m4a';

test('first tracks use zero-based indexes and single releases win duplicate album tracks',()=>{
  assert.deepEqual(resolveSongMentions('Start with **Cybertruck**, then **Designer**. Cybertruck still hits.'),[
    song('/cybertruck',0),song('/designer',0)
  ]);
  assert.deepEqual(resolveSongMentions('Magic (Tragic) is the one.'),[album]);
  assert.deepEqual(resolveSongMentions('Try Magic—Tragic.'),[album]);
});

test('all catalog songs resolve to real preview entries, including the local Cats Cash preview',()=>{
  const catalog=JSON.parse(readFileSync(new URL('../release-data.js',import.meta.url),'utf8').split(' = ')[1].trim().replace(/;$/,''));
  for(const release of catalog.releases){
    for(const [trackIndex,title] of release.tracks.entries()){
      const matchingSingle=catalog.releases.find(item=>item.type==='single'&&item.tracks.includes(title));
      const expected=matchingSingle?song(`/${matchingSingle.page}`,matchingSingle.tracks.indexOf(title)):song(`/${release.page}`,trackIndex);
      assert.deepEqual(resolveSongMentions(`The song **${title}**.`),[expected],title);
    }
  }
});

test('feature aliases, case, punctuation, and curly apostrophes identify the same track',()=>{
  assert.deepEqual(resolveSongMentions('“COCO\'S INTERLUDE” and **luca’s interlude**.'),[
    song('/jacksandersuperstar',8),song('/prodigygenius',5)
  ]);
  for(const title of ['breathe (ft. sk8star)','Breathe (feat. SK8STAR)','breathe (featuring sk8star)','"Breathe"']){
    assert.deepEqual(resolveSongMentions(title),[song('/jacksandersuperstar',13)],title);
  }
  assert.deepEqual(resolveSongMentions('The track is step on them.'),[song('/jacksandersuperstar',3)]);
});

test('ordinary phrases and word fragments do not attach unrelated previews',()=>{
  for(const text of [
    'I work as a designer.', 'Just breathe.', 'Spend it how you want.', 'swag.',
    'idgaf.', 'bb.', 'omg.', 'I would never kill you.', 'We can brainstorm ideas.',
    'A cybertruck is an electric truck.', 'The leprechaun costume.',
    'designerly swaggy cyberspace magic tragically shakespheres.'
  ])assert.deepEqual(resolveSongMentions(text),[],text);
});

test('ambiguous titles are allowed when quoted, recommended, or part of a music conversation',()=>{
  assert.deepEqual(resolveSongMentions('**bb**.'),[song('/prodigygenius',9)]);
  assert.deepEqual(resolveSongMentions("'swag' is my pick."),[song('/prodigygenius',3)]);
  assert.deepEqual(resolveSongMentions('Start with designer.'),[song('/designer',0)]);
  assert.deepEqual(resolveSongMentions('breathe fits that mood.','Which song should I listen to?'),[song('/jacksandersuperstar',13)]);
  assert.deepEqual(resolveSongMentions('The song kill you.'),[song('/jacksandersuperstar',5)]);
});

test('album names and album paths do not turn into individual track previews',()=>{
  for(const text of ['Try **prodigy genius**.','The latest album is **#jacksandersuperstar®**.','Visit /jacksandersuperstar.']){
    assert.deepEqual(resolveSongMentions(text,'Which song should I start with?'),[],text);
  }
  assert.deepEqual(resolveSongMentions('The title track **#jacksandersuperstar**.'),[song('/jacksandersuperstar',14)]);
  assert.deepEqual(resolveSongMentions('**#jacksandersuperstar**.','Play the song #jacksandersuperstar.'),[song('/jacksandersuperstar',14)]);
});

test('known single release paths resolve without matching longer paths or external hosts',()=>{
  for(const [path,releasePage] of [['/cybertruck','/cybertruck'],['/designer','/designer'],['/brainstorm','/brainstorm'],['/catscash','/catscash'],['/cats-cash','/catscash']]){
    assert.deepEqual(resolveSongMentions(`It's at ${path}.`),[song(releasePage,0)],path);
  }
  for(const text of ['Visit /designer-tools.','https://example.com/designer','Visit /notdesigner.']){
    assert.deepEqual(resolveSongMentions(text),[],text);
  }
});

test('unavailable or untrusted preview URLs cannot produce an attachment',()=>{
  const release={title:'test single',type:'single',page:'test',tracks:['unique test song']};
  for(const preview of [undefined,'http://audio-ssl.itunes.apple.com/a.m4a','https://audio-ssl.itunes.apple.com.evil.test/a.m4a','https://evil.test/a.m4a','javascript:alert(1)','assets/previews/../secret.m4a']){
    assert.deepEqual(resolveSongMentions('unique test song','',[{...release,previews:[preview]}]),[],String(preview));
  }
  assert.deepEqual(resolveSongMentions('unique test song','',[{...release,previews:[apple]}]),[song('/test',0)]);
  assert.deepEqual(resolveSongMentions('unique test song','',[{...release,previews:['/assets/previews/test.m4a']}]),[song('/test',0)]);
});
