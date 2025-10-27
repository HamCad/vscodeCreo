import * as vscode from 'vscode';
//import { CreoHoverProvider } from './providers/hoverProvider';
//import { CreoHoverProvider } from './providers/hoverProvider_v1';
import { CreoHoverProvider } from './providers/hoverProvider_v2';
import { CreoFoldingProvider } from './providers/foldingProvider';
import { parseMapkeys, getMapkeyAtPosition } from './server/mapkeyStructure';

export function activate(context: vscode.ExtensionContext) {
  const selector: vscode.DocumentSelector = [{ language: 'pro', scheme: 'file' }];

  // Register hover provider only
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(selector, new CreoHoverProvider())
  );

  context.subscriptions.push(
    vscode.languages.registerFoldingRangeProvider(
      selector, 
      new CreoFoldingProvider()  // ✅ Instantiate the class
    )
  );
   //
   // const mapkeys = parseMapkeys(text);
   // const diagnostics: vscode.Diagnostic[] = [];
   //
   // for (const mapkey of mapkeys) {
   //   // Check if mapkey has an end
   //   if (!mapkey.endToken) {
   //     diagnostics.push(new vscode.Diagnostic(
   //       new vscode.Range(
   //         document.positionAt(mapkey.range.start),
   //         document.positionAt(mapkey.range.end)
   //       ),
   //       'Mapkey definition has no ending semicolon',
   //       vscode.DiagnosticSeverity.Warning
   //     ));
   //   }
   // }
   //
   // const graph = buildCallGraph(text);
   // console.log('Mapkey dependencies:', graph);
   // // Use this to create a tree view or graph visualization


  vscode.window.showInformationMessage('Creo Mapkey extension active: hover ready.');
}


export function deactivate() {}
