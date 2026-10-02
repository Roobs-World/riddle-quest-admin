const {test} = require('node:test');
const {execFileSync} = require('node:child_process');
const path = require('node:path');

test('configured Sentry preserves structured OpenAI response body consumption', () => {
  execFileSync(process.execPath, ['-e', `
    const assert = require('node:assert/strict');
    const Sentry = require('@sentry/node');
    const originalInit = Sentry.init;
    Sentry.init = options => originalInit({...options, transport: () => ({
      send: async () => ({statusCode: 200}), flush: async () => true,
    })});
    const {withSentrySpan} = require('./lib/shared/sentry');
    const OpenAI = require('openai').default;
    const {zodTextFormat} = require('openai/helpers/zod');
    const {z} = require('zod');
    const client = new OpenAI({apiKey: 'fixture-only', maxRetries: 0,
      fetch: async () => new Response(JSON.stringify({id: 'fixture', object: 'response', status: 'completed',
        output: [{type: 'message', id: 'm', role: 'assistant', status: 'completed',
          content: [{type: 'output_text', text: JSON.stringify({answer: 'piano'}), annotations: []}]}],
      }), {headers: {'Content-Type': 'application/json'}}),
    });
    withSentrySpan('fixture', 'ai.generate', () => client.responses.parse({
      model: 'fixture', input: 'fixture', text: {format: zodTextFormat(z.object({answer: z.string()}), 'fixture')},
    })).then(result => assert.equal(result.output_parsed.answer, 'piano'))
      .catch(error => {console.error(error.name, error.message); process.exitCode = 1;})
      .finally(() => Sentry.close(100));
  `], {cwd: path.resolve(__dirname, '..'), env: {...process.env, SENTRY_DSN: 'https://fixture@localhost/1'}, stdio: 'pipe'});
});
