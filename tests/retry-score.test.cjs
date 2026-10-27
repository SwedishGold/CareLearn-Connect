const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const test = require('node:test');
const { JSDOM, ResourceLoader } = require('jsdom');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scripts = text => [...text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);

test('all current and archived inline scripts parse', () => {
  for (const file of ['index.html', ...['v2', 'v3', 'v4', 'v5'].map(v => `versions/${v}.html`)]) {
    for (const script of scripts(fs.readFileSync(path.join(root, file), 'utf8'))) {
      new vm.Script(script, { filename: file });
    }
  }
});

function offlineApp() {
  let networkCalls = 0;
  const forbidden = () => { networkCalls++; throw new Error('Network forbidden in offline tests'); };
  class NoNetwork extends ResourceLoader { fetch() { return forbidden(); } }
  const dom = new JSDOM(html, {
    runScripts: 'outside-only', url: 'https://offline.invalid/', resources: new NoNetwork(),
    beforeParse(w) {
      w.fetch = forbidden;
      w.XMLHttpRequest = class { constructor() { forbidden(); } };
      w.WebSocket = class { constructor() { forbidden(); } };
      w.EventSource = class { constructor() { forbidden(); } };
      w.navigator.sendBeacon = forbidden;
    }
  });
  const w = dom.window;
  w.eval(scripts(html).join('\n') + '\nwindow.__test = {UI, Engine, AI, StateManager, SessionManager, DeltaLogger, InstructorTools};');
  return { dom, w, ...w.__test, networkCalls: () => networkCalls };
}
const settle = () => new Promise(resolve => setTimeout(resolve, 550));

for (const role of ['usk', 'ssk']) {
  for (const first of ['optimal', 'partial', 'zero']) {
    test(`${role}: ${first} first attempts count once across all three scenarios and learning retries`, async () => {
      const app = offlineApp();
      const { dom, w, UI, Engine, AI, StateManager, SessionManager, DeltaLogger, InstructorTools } = app;
      try {
        UI.init(); UI.selectDomain('piva'); UI.selectRole(role);
        const sessionId = SessionManager.createSession('piva', role);
        Engine.start();
        assert.equal(AI.isDemo, true);
        assert.equal(Engine.scenarios.length, 3);
        let expectedScore = 0;
        let expectedOptimal = 0;
        for (let i = 0; i < 3; i++) {
          const scenario = Engine.scenarios[i];
          const optimal = scenario.choices.findIndex(c => c.isOptimal);
          const selected = scenario.choices.findIndex(c => first === 'optimal' ? c.isOptimal :
            first === 'zero' ? c.points === 0 : c.points > 0 && !c.isOptimal);
          assert.ok(selected >= 0);
          const choice = scenario.choices[selected];
          expectedScore += choice.points;
          expectedOptimal += Number(choice.isOptimal);
          await Engine.selectChoice(selected); await settle();
          assert.equal(Engine.score, expectedScore);
          assert.equal(Engine.stats.optimal, expectedOptimal);
          const logLength = DeltaLogger.getLog().length;
          // Repeated clicks without Retry remain blocked.
          await Engine.selectChoice(selected);
          assert.equal(DeltaLogger.getLog().length, logLength);
          for (const retryChoice of [selected, optimal]) {
            assert.ok(w.document.querySelector('#actionBar').classList.contains('show'));
            Engine.retry();
            assert.equal(Engine.currentIndex, i);
            assert.equal(Engine.answered, false);
            assert.equal(JSON.stringify(StateManager.current), JSON.stringify(scenario.initialState));
            assert.equal(w.document.querySelectorAll('.choice-btn:disabled').length, 0);
            await Engine.selectChoice(retryChoice); await settle();
            assert.equal(Engine.score, expectedScore, `scenario ${i}: retry must not add points`);
            assert.equal(Engine.stats.optimal, expectedOptimal, 'retry must not inflate optimal-scenario count');
            assert.equal(w.document.getElementById('scoreValue').textContent, String(expectedScore));
            assert.match(w.document.getElementById('feedbackSubtitle').textContent, /inga nya poäng/);
            assert.ok(w.document.getElementById('feedbackPanel').classList.contains('show'));
            assert.equal(w.document.querySelectorAll('.message.patient').length, 2);
            assert.equal(w.document.querySelectorAll('.choice-btn:disabled').length, scenario.choices.length);
            assert.ok(Object.values(StateManager.current).every(n => n >= 0 && n <= 100));
          }
          const decisions = DeltaLogger.exportSession().decisions.filter(d => d.scenario === i + 1);
          assert.equal(decisions.length, 3, 'retain all learning attempts in export');
          assert.deepEqual(Array.from(decisions, d => d.points), [choice.points, 0, 0]);
          assert.equal(decisions[2].wasOptimal, true, 'retain the retry choice quality');
          Engine.next();
        }
        const exported = DeltaLogger.exportSession();
        assert.equal(exported.session.id, sessionId);
        assert.equal(exported.session.role, role);
        assert.equal(exported.decisions.length, 9);
        assert.equal(exported.totalScore, expectedScore);
        assert.equal(exported.totalScore, exported.decisions.reduce((sum, d) => sum + d.points, 0));
        assert.equal(exported.optimalChoices, expectedOptimal);
        assert.equal(exported.totalScenarios, 3);
        assert.equal(exported.maxScore, 30);
        assert.equal(exported.percentage, Math.round(expectedScore / 30 * 100));
        assert.ok(exported.percentage <= 100);
        assert.equal(Engine.stats.attempts, 9);
        assert.ok(w.document.getElementById('resultsScreen').classList.contains('active'));
        assert.equal(w.document.getElementById('finalScoreValue').textContent, String(expectedScore));
        assert.deepEqual(Object.keys(exported.decisions[0]).sort(),
          ['scenario', 'choice', 'choiceText', 'wasOptimal', 'points', 'stateChanges'].sort());
        // Exercise the actual JSON and CSV exporters without navigating or downloading files.
        const blobs = [];
        let downloads = 0;
        w.URL.createObjectURL = blob => { blobs.push(blob); return 'blob:offline-test'; };
        w.URL.revokeObjectURL = () => {};
        w.HTMLAnchorElement.prototype.click = () => { downloads++; };
        const readBlob = blob => new Promise((resolve, reject) => {
          const reader = new w.FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(reader.error);
          reader.readAsText(blob);
        });
        InstructorTools.exportJSON(); InstructorTools.downloadCSV();
        assert.equal(downloads, 2);
        const jsonExport = JSON.parse(await readBlob(blobs[0]));
        assert.equal(jsonExport.totalScore, expectedScore);
        assert.equal(jsonExport.optimalChoices, expectedOptimal);
        assert.equal(JSON.stringify(jsonExport.decisions), JSON.stringify(exported.decisions));
        const csvRows = (await readBlob(blobs[1])).split('\n').slice(1).map(row => row.split(','));
        assert.equal(csvRows.length, 9);
        assert.equal(csvRows.reduce((sum, row) => sum + Number(row[3]), 0), expectedScore);
        assert.deepEqual(csvRows.map(row => Number(row[3])), Array.from(exported.decisions, d => d.points));
        // Existing lifecycle: restart returns to setup; a new session/start clears scores and logs.
        Engine.restart();
        assert.ok(w.document.getElementById('setupScreen').classList.contains('active'));
        const nextId = SessionManager.createSession('piva', role);
        assert.notEqual(nextId, sessionId);
        Engine.start();
        assert.equal(Engine.score, 0);
        assert.equal(Engine.stats.optimal, 0);
        assert.equal(Engine.stats.attempts, 0);
        assert.equal(DeltaLogger.exportSession().decisions.length, 0);
        const nextOptimal = Engine.scenarios[0].choices.findIndex(c => c.isOptimal);
        await Engine.selectChoice(nextOptimal); await settle();
        assert.equal(Engine.score, 10, 'new session may earn points again');
        assert.equal(DeltaLogger.exportSession().session.id, nextId);
        assert.equal(app.networkCalls(), 0);
        console.log(`PASS role=${role} first=${first} scenarios=3 attempts=9 score=${expectedScore} networkCalls=0 newSessionScore=10`);
      } finally { dom.window.close(); }
    });
  }
}
