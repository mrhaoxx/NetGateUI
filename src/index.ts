import { type JSONSchemaForSchemaStoreOrgCatalogFiles } from '@schemastore/schema-catalog'
import { editor, languages, MarkerSeverity, type Position, Range, Uri } from 'monaco-editor'
import * as monaco from 'monaco-editor'
import { ILanguageFeaturesService } from 'monaco-editor/esm/vs/editor/common/services/languageFeatures.js'
import { OutlineModel } from 'monaco-editor/esm/vs/editor/contrib/documentSymbols/browser/outlineModel.js'
import { StandaloneServices } from 'monaco-editor/esm/vs/editor/standalone/browser/standaloneServices.js'
import { configureMonacoYaml, type SchemasSettings } from 'monaco-yaml'

import './index.css'


window.MonacoEnvironment = {
  getWorker(moduleId, label) {
    switch (label) {
      case 'editorWorkerService':
        return new Worker(new URL('monaco-editor/esm/vs/editor/editor.worker', import.meta.url))
      case 'yaml':
        return new Worker(new URL('monaco-yaml/yaml.worker', import.meta.url))
      default:
        throw new Error(`Unknown label ${label}`)
    }
  }
}

const defaultSchema: SchemasSettings = {
  uri: '/api/v1/cfg/schema',
  fileMatch: ['config.yaml']
}

const monacoYaml = configureMonacoYaml(monaco, {
  enableSchemaRequest: true,
  schemas: [defaultSchema]
})

const value = `# Wait For Javascript to Get The Config
`.replace(/:$/m, ': ')


const ed = editor.create(document.getElementById('editor')!, {
  automaticLayout: true,
  model: editor.createModel(value, 'yaml', Uri.parse('config.yaml')),
  theme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'vs-dark' : 'vs-light',
  quickSuggestions: {
    other: true,
    comments: false,
    strings: true
  },
  formatOnType: true
})



/**
 * Get the document symbols that contain the given position.
 *
 * @param symbols
 *   The symbols to iterate.
 * @param position
 *   The position for which to filter document symbols.
 * @yields
 * The document symbols that contain the given position.
 */
function* iterateSymbols(
  symbols: languages.DocumentSymbol[],
  position: Position
): Iterable<languages.DocumentSymbol> {
  for (const symbol of symbols) {
    if (Range.containsPosition(symbol.range, position)) {
      yield symbol
      if (symbol.children) {
        yield* iterateSymbols(symbol.children, position)
      }
    }
  }
}


editor.onDidChangeMarkers(([resource]) => {
  const problems = document.getElementById('problems')!
  const markers = editor.getModelMarkers({ resource })
  while (problems.lastChild) {
    problems.lastChild.remove()
  }
  var isOK = true;
  for (const marker of markers) {
    if (marker.severity === MarkerSeverity.Hint) {
      continue
    }
    isOK = false;
    const wrapper = document.createElement('div')
    wrapper.setAttribute('role', 'button')
    const codicon = document.createElement('div')
    const text = document.createElement('div')
    wrapper.classList.add('problem')
    codicon.classList.add(
      'codicon',
      marker.severity === MarkerSeverity.Warning ? 'codicon-warning' : 'codicon-error'
    )
    text.classList.add('problem-text')
    text.textContent = marker.message
    wrapper.append(codicon, text)
    wrapper.addEventListener('click', () => {
      ed.setPosition({ lineNumber: marker.startLineNumber, column: marker.startColumn })
      ed.focus()
    })
    problems.append(wrapper)
  }

  if (isOK) {
    const wrapper = document.createElement('div')
    wrapper.classList.add('problem')
    const codicon = document.createElement('div')
    codicon.classList.add(
      'codicon',
      'codicon-check'
    )
    const text = document.createElement('div')
    text.classList.add('problem-text')
    text.textContent = "No Problems Found"
    wrapper.append(codicon, text)
    problems.append(wrapper)
  }

})


const problems = document.getElementById('problems')!
const wrapper = document.createElement('div')
wrapper.classList.add('problem')
const codicon = document.createElement('div')
codicon.classList.add(
  'codicon',
  'codicon-check'
)
const text = document.createElement('div')
text.classList.add('problem-text')
text.textContent = "No Problems Found"
wrapper.append(codicon, text)
problems.append(wrapper)

async function update() {
  try {
    const response = await fetch('/api/v1/cfg/get');
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    const text = await response.text();
    ed.setValue(text);
    document.getElementById('status')!.textContent = 'Config Loaded ' + "Length " + text.length + " " + new Date().toISOString();
  } catch (error) {
    alert(error.message);
  }
}

async function save() {
  try {
    const response = await fetch('/api/v1/cfg/save', {
      method: 'POST',
      body: ed.getValue()
    });
    document.getElementById('status')!.textContent = 'Config Saved ' + response.statusText + " " + new Date().toISOString();
  } catch (error) {
    alert('Request failed');
  }
}

async function shutdown() {
  try {
    const response = await fetch('/shutdown');
    alert(response.status);
  } catch (error) {
    alert('Request failed');
  }
}

async function hash() {
  const ha = document.getElementById('hasky') as HTMLInputElement;
  try {
    const response = await fetch('/genhash', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: ha.value
    });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    ha.value = await response.text();
  } catch (error) {
    alert(error.message);
  }
}
ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
  save();
});

document.getElementById('shutdown')?.addEventListener('click', shutdown);
document.getElementById('Hash')?.addEventListener('click', hash);
document.getElementById('update')?.addEventListener('click', update);
document.getElementById('save')?.addEventListener('click', save);

update();


