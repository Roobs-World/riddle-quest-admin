#!/usr/bin/env node
'use strict';
const {execFileSync} = require('node:child_process');
const {writeFileSync} = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const {SUPPORTED_LOCALES} = require(path.join(root, 'firebase-functions/packages/core/dist/validation/locales.js'));
const {getDailyDate} = require(path.join(root, 'firebase-functions/packages/core/dist/validation/dailyCalendar.js'));
const {isPlayableSinglePlayerAnswer} = require(path.join(root, 'firebase-functions/lib/gameplay/singlePlayerAnswerPolicy.js'));
const {clueContainsLiteralAnswer} = require(path.join(root, 'firebase-functions/lib/riddles/riddleQuality.js'));

(async () => {
  const now = new Date();
  const token = execFileSync('gcloud', ['auth', 'print-access-token', '--quiet'], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();
  const fields = ['locale', 'challengeKey', 'text', 'answer', 'difficultyBand'];
  const documents = await Promise.all(SUPPORTED_LOCALES.map(async locale => {
    const challengeDate = getDailyDate(locale, now);
    const documentId = `daily-${challengeDate}`;
    const query = new URLSearchParams();
    for (const field of fields) query.append('mask.fieldPaths', field);
    const url = `https://firestore.googleapis.com/v1/projects/riddle-quest-ec2b2/databases/(default)/documents/localizedRiddles/${locale}/riddles/${documentId}?${query}`;
    const response = await fetch(url, {headers: {Authorization: `Bearer ${token}`}});
    if (!response.ok) return {locale, challengeDate, documentId, exists: response.status !== 404 ? null : false, httpStatus: response.status, playable: false};
    const document = await response.json();
    const value = name => document.fields?.[name]?.stringValue;
    const text = value('text'), answer = value('answer');
    const validText = typeof text === 'string' && text.length > 0;
    const validAnswer = isPlayableSinglePlayerAnswer(answer);
    const clueIsPlayable = validText && validAnswer && !clueContainsLiteralAnswer(text, answer);
    return {locale, challengeDate, documentId, exists: true, httpStatus: response.status,
      localeMatches: value('locale') === locale, challengeDateMatches: value('challengeKey') === challengeDate,
      validClueText: validText, keyboardCompatibleAnswer: validAnswer, clueDoesNotRevealAnswer: clueIsPlayable,
      difficultyBand: ['easy', 'medium', 'hard'].includes(value('difficultyBand')) ? value('difficultyBand') : null,
      playable: value('locale') === locale && value('challengeKey') === challengeDate && clueIsPlayable,
      createTime: document.createTime, updateTime: document.updateTime};
  }));
  const report = {checkedAt: now.toISOString(), project: 'riddle-quest-ec2b2', mode: 'read-only-current-regional-daily-documents',
    requestedLocales: SUPPORTED_LOCALES.length, documents, playableLocales: documents.filter(item => item.playable).length,
    missingOrUnplayableLocales: documents.filter(item => !item.playable).map(item => item.locale),
    privacy: 'Read canonical text/answers only in process memory to apply existing production predicates. No content, answer, credential or player data is persisted.', writesPerformed: false, generationTriggered: false};
  writeFileSync(path.join(__dirname, 'daily-availability.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({playableLocales: report.playableLocales, missingOrUnplayableLocales: report.missingOrUnplayableLocales}));
})().catch(error => {
  writeFileSync(path.join(__dirname, 'daily-availability-read-failed.json'), JSON.stringify({readSucceeded: false, errorClass: error?.name ?? 'unknown', messageAndCredentialsOmitted: true}) + '\n');
  console.error('Daily metadata read failed; raw exception omitted.');
  process.exitCode = 1;
});
