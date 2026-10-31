const fs=require('fs'),crypto=require('crypto');
const root='/home/craig-beswetherick/Documents/riddle-quest';
const ts=require(root+'/packages/portal/node_modules/typescript');
const before=fs.readFileSync('/tmp/riddle-provisional-before-extraction.ts','utf8');
const after=fs.readFileSync(root+'/packages/portal/src/play/game/hooks/useProvisionalPlayRecovery.ts','utf8');
const leaf=fs.readFileSync(root+'/packages/portal/src/play/game/hooks/useQueuedContinueSubmit.ts','utf8');
function source(text){return ts.createSourceFile('source.ts',text,ts.ScriptTarget.Latest,true)}
function walk(n,test){if(test(n))return n;let found;ts.forEachChild(n,child=>{found??=walk(child,test)});return found}
function variable(text,name){let src=source(text);const node=walk(src,n=>ts.isVariableDeclaration(n)&&n.name.getText(src)===name);if(!node)throw Error('Missing variable '+name);return node.initializer.getText(src)}
function callback(text,name){return variable(text,name).split(/,\s*\[/)[0]}
function effect(text,name){let src=source(text);return walk(src,n=>ts.isCallExpression(n)&&n.expression.getText(src)==='useEffect'&&n.arguments[0]?.getText(src).includes('if (!'+name+' || stateRef.current !== state)')).arguments[0].getText(src)}
const replacements=[['currentAttempt.join("")','guess'],['queuedContinueSubmit','intent'],['setQueuedContinueSubmit','setIntent'],['consumedContinueSubmitRef','consumedRequest'],['canQueueContinueSubmit','canQueue'],['submitReadyGuess','onSubmit']];
function map(text){for(const [old,value]of replacements)text=text.split(old).join(value);return text.replace(/guess:\s*guess,/g,"guess,")}
function tokens(text){const scanner=ts.createScanner(ts.ScriptTarget.Latest,true,ts.LanguageVariant.Standard,text);const t=[];while(scanner.scan()!==ts.SyntaxKind.EndOfFileToken)t.push(scanner.getTokenText());return JSON.stringify(t)}
const rows=[['ordinary durable guess callback',callback(before,'submitReadyGuess'),callback(after,'submitReadyGuess'),false],['pending Continue admission',variable(before,'canQueueContinueSubmit'),variable(leaf,'canQueue'),true],['retained click busy state',variable(before,'submitPending'),variable(leaf,'submitPending'),true],['submit click body',callback(before,'submitGuess'),callback(leaf,'submitGuess'),true],['accepted-intent delivery effect',effect(before,'queuedContinueSubmit'),effect(leaf,'intent'),true],['paid receipt validation',variable(before,'accepted').replaceAll('message.payload.ok','ok').replaceAll('message.payload.data','data'),variable(leaf,'accepted'),false]].map(([check,old,current,rename])=>{const a=tokens(rename?map(old):old),b=tokens(current);return {check,matches:a===b,beforeTokensSha256:crypto.createHash('sha256').update(a).digest('hex'),afterTokensSha256:crypto.createHash('sha256').update(b).digest('hex')}});
const report={scope:'Static token comparison of unchanged ordinary delivery and extracted decisions. This does not execute tests or prove React lifecycle behavior.',rows};fs.writeFileSync('/tmp/riddle-queued-extraction-static-proof.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(rows.map(({check,matches})=>({check,matches})),null,2));
