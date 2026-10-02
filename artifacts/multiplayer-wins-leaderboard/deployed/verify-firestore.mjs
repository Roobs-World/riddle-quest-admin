import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';

const token = execFileSync('gcloud', ['auth', 'print-access-token'], {encoding: 'utf8'}).trim();
const root = 'https://firestore.googleapis.com/v1/projects/riddle-quest-ec2b2/databases/(default)';
const headers = {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'};
const directory = new URL('./', import.meta.url);
const operationName = JSON.parse(readFileSync(new URL('index-operation.json', directory), 'utf8')).response.name;
const operation = await (await fetch(`https://firestore.googleapis.com/v1/${operationName}`, {headers})).json();
const fieldResponse = await fetch(`${root}/collectionGroups/users/fields/stats.multiplayerWins`, {headers});
const field = await fieldResponse.json();
const queryResponse = await fetch(`${root}/documents:runQuery`, {
  method: 'POST', headers,
  body: JSON.stringify({structuredQuery: {
    select: {fields: [{fieldPath: 'stats.multiplayerWins'}]},
    from: [{collectionId: 'users'}],
    where: {fieldFilter: {field: {fieldPath: 'stats.multiplayerWins'}, op: 'GREATER_THAN', value: {integerValue: '0'}}},
    orderBy: [{field: {fieldPath: 'stats.multiplayerWins'}, direction: 'DESCENDING'}],
    limit: 25,
  }}),
});
const rows = await queryResponse.json();
const scores = Array.isArray(rows)
  ? rows.filter(row => row.document).map(row => Number(row.document.fields.stats.mapValue.fields.multiplayerWins.integerValue))
  : [];
const evidence = {
  verifiedAt: new Date().toISOString(), operation,
  indexHttpStatus: fieldResponse.status, indexConfig: field.indexConfig ?? field.error,
  queryHttpStatus: queryResponse.status, resultCount: scores.length, scores,
  descending: queryResponse.ok && scores.every((score, index) => index === 0 || scores[index - 1] >= score),
  queryErrors: Array.isArray(rows) ? rows.filter(row => row.error).map(row => row.error) : rows.error,
};
writeFileSync(new URL('firestore.json', directory), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence, null, 2));
