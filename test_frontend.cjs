const assert=require('node:assert/strict');
const {parseCsvRows,normalizedTitle,CSV,metricSummary,reportMarkdown}=require('./web/app.js');
let checks=0;
function test(name,fn){fn();checks++;console.log('PASS '+name);}
test('missing metrics are not zero engagement',()=>assert.equal(metricSummary({duration:5,shots:[],metrics:{views:100}}).engagement,null));
test('known zeros remain zero',()=>assert.equal(metricSummary({duration:5,shots:[{}],metrics:{views:100,likes:0,shares:0,saves:0,comments:0}}).engagement,0));
test('complete engagement arithmetic',()=>assert.equal(metricSummary({duration:5,shots:[{},{}],metrics:{views:100,likes:2,shares:1,saves:1,comments:1}}).engagement,5));
test('unknown cuts are not negative',()=>assert.equal(metricSummary({duration:5,shots:[],metrics:{}}).cuts,null));
test('zero views has no ratio',()=>assert.equal(metricSummary({duration:5,shots:[],metrics:{views:0,likes:0,shares:0,saves:0,comments:0}}).engagement,null));
test('CSV quoted commas',()=>assert.deepEqual(parseCsvRows('title,views\n"Example, one",42'),[['title','views'],['Example, one','42']]));
test('CSV rejects unclosed quote',()=>assert.throws(()=>parseCsvRows('"unclosed')));
test('CSV formula cells neutralised',()=>assert.ok(CSV('=1+1').startsWith('"\'')));
test('Unicode titles remain distinct',()=>assert.notEqual(normalizedTitle('東京.mp4'),normalizedTitle('大阪.mp4')));
test('filename matching',()=>assert.equal(normalizedTitle(' Example.MP4 '),'example'));
test('report carries evidence limits',()=>{const x=reportMarkdown({title:'Test',duration:5,shots:[],segments:[],metrics:{views:100},transcript_source:'none',notices:[]});assert.ok(x.includes('not supplied'));assert.ok(x.includes('rule-based'));assert.ok(x.includes('not evidence of causation'));});
console.log('FRONTEND_CHECKS='+checks);
