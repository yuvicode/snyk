import * as fs from 'then-fs';
import * as path from 'path';
import * as Debug from 'debug';
const debug = Debug('snyk');

import {getPluginHelpTxt} from '../../lib/plugins';

export = async function help(item: string | boolean) {
  if (!item || item === true || typeof item !== 'string') {
    item = 'usage';
  }

  // cleanse the filename to only contain letters
  // aka: /\W/g but figured this was easier to read
  const cleanItem = item.replace(/[^a-z-]/gi, '');

  const filename = path.resolve(__dirname, '../../../help', cleanItem + '.txt');
  let localHelp: boolean = false;
  try {
    if (fs.existsSync(filename)) {
      localHelp = true;
      return await fs.readFile(filename, 'utf8');
    }
    return await fs.readFile(getPluginHelpTxt(item), 'utf-8');
  } catch (error) {
    debug(error);
    if (localHelp) {
      return `'${cleanItem}' help can't be found at location: ${filename}`;
    }
    return `${item} documentation could not be found`;
  }
};
