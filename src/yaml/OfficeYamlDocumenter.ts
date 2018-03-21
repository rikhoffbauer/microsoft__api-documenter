// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.

import * as colors from 'colors';
import * as fsx from 'fs-extra';
import * as path from 'path';
import yaml = require('js-yaml');

import { DocItemSet } from '../utils/DocItemSet';
import { IYamlTocItem } from './IYamlTocFile';
import { IYamlItem } from './IYamlApiFile';
import { YamlDocumenter } from './YamlDocumenter';

interface ISnippetsFile {
  /**
   * The keys are API names like "Excel.Range.clear".
   * The values are TypeScript source code excerpts.
   */
  [apiName: string]: string[];
}

/**
 * Extends YamlDocumenter with some custom logic that is specific to Office Add-ins.
 */
export class OfficeYamlDocumenter extends YamlDocumenter {
  private _snippets: ISnippetsFile;

  public constructor(docItemSet: DocItemSet, inputFolder: string) {
    super(docItemSet);

    const snippetsFilePath: string = path.join(inputFolder, 'snippets.yaml');

    console.log('Loading snippets from ' + snippetsFilePath);
    const snippetsContent: string = fsx.readFileSync(snippetsFilePath).toString();
    this._snippets = yaml.load(snippetsContent, { filename: snippetsFilePath });
  }

  public generateFiles(outputFolder: string): void { // override
    super.generateFiles(outputFolder);

    // After we generate everything, check for any unused snippets
    console.log();
    for (const apiName of Object.keys(this._snippets)) {
      console.error(colors.yellow('Warning: Unused snippet ' + apiName));
    }
  }

  protected onGetTocRoot(): IYamlTocItem { // override
    return {
      name: 'Office Add-ins',
      items: [ ]
    };
  }

  protected onCustomizeYamlItem(yamlItem: IYamlItem): void { // override
    const nameWithoutPackage: string = yamlItem.uid.replace(/^[^.]+\./, '');

    const snippets: string[] | undefined = this._snippets[nameWithoutPackage];
    if (snippets) {
      delete this._snippets[nameWithoutPackage];

      if (!yamlItem.remarks) {
        yamlItem.remarks = '';
      }

      yamlItem.remarks += '\n\n#### Examples\n';
      for (const snippet of snippets) {
        if (snippet.search(/await/) === -1) {
          yamlItem.remarks += '\n```javascript\n' + snippet + '\n```\n';
        } else {
          yamlItem.remarks += '\n```typescript\n' + snippet + '\n```\n';
        }
      }
    }

    if (yamlItem.summary) {
      yamlItem.summary = this._fixupApiSet(yamlItem.summary, yamlItem.uid);
    }
    if (yamlItem.remarks) {
      yamlItem.remarks = this._fixupApiSet(yamlItem.remarks, yamlItem.uid);
    }
  }

  private _fixupApiSet(markup: string, uid: string): string {
    // Search for a pattern such as this:
    // \[Api set: ExcelApi 1.1\]
    //
    // Hyperlink it like this:
    // \[ [API set: ExcelApi 1.1](http://bing.com?type=excel) \]
    markup = markup.replace(/Api/, 'API');
    if (uid.search(/Excel/i) !== -1) {
      return markup.replace(/\\\[(API set:[^\]]+)\\\]/, `\\[ [$1](http://bing.com?type=excel) \\]`);
    } else if (uid.search(/OneNote/i) !== -1) {
      return markup.replace(/\\\[(API set:[^\]]+)\\\]/, `\\[ [$1](http://bing.com?type=onenote) \\]`);
    } else if (uid.search(/Visio/i) !== -1) {
      return markup.replace(/\\\[(API set:[^\]]+)\\\]/, `\\[ [$1](http://bing.com?type=visio) \\]`);
    } else if (uid.search(/Outlook/i) !== -1) {
      return markup.replace(/\\\[(API set:[^\]]+)\\\]/, `\\[ [$1](http://bing.com?type=outlook) \\]`);
    } else if (uid.search(/Word/i) !== -1) {
      return markup.replace(/\\\[(API set:[^\]]+)\\\]/, `\\[ [$1](http://bing.com?type=word) \\]`);
    } else {
      return markup.replace(/\\\[(API set:[^\]]+)\\\]/, `\\[ [$1](http://bing.com) \\]`);
    }
  }
}
