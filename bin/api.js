#! /usr/bin/env node

var instance = process.env.npm_package_config_syncano;
console.log('Instance',instance)
var instanceUrl = `https://api.syncano.io/v2/instances/${instance}/endpoints/sockets/`;
var fetch = require('node-fetch');
let camelCase = require('lodash.camelcase');
var fs = require('fs');
const typeMap = {
  integer: 'number',
  float: 'number',
  array: 'Array<any>',
  object: 'Object',
  file: 'File',
  string: 'string'
};

let endpoint = ({ name, metadata: { parameters, description = '' } }) => {
  let params = '';
  let firstLine = '';
  let tsInterface = '';
  let outParams = '';
  let docparams = '';
  let camelName = camelCase(name, '-');
  if (parameters) {
    params = Object.keys(parameters);
    outParams = params.map((p) => `'${p}':${camelCase(p, '-')}`);
    params = params.map((p) => camelCase(p, '-')).join(',\n\t\t');
    docparams = Object.keys(parameters).map(
      (p) => ` * @param {${parameters[p].type}} ${camelCase(p, '-')} - ${parameters[p].description}`
    );
    docparams = '\n' + docparams.join('\n');
    tsInterface = Object.keys(parameters).map(
      (p) =>
        `${camelCase(p, '-')}${parameters[p].required ? '' : '?'}:${typeMap[parameters[p].type]}`
    );
    tsInterface = `:{
\t\t${tsInterface.join(',\n\t\t')}
},`;
    firstLine = `{
\t\t${params}
}`;
  }

  return `
/**
 * ${description}${docparams}
 */
export const ${camelName} = (s:SyncanoClientType) => (${firstLine}${tsInterface}
  options={
    method:'post'
  }
) => {
        return s[options.method](
        '${name}',
        toFormDataOrObject({
            ${outParams}
        })
      )
}
`;
};
const generateFile = (sockets) => {
  console.log(sockets)
  let allFile = `// DO NOT EDIT!
// This file was generated as part of build process.
// Any changes made to this file WILL be discarded
// during next build.

export type SyncanoClientType = {
    post: (endpointName: String, options?: any) => Promise<any>;
    setToken: (token: String) => void;
};
  
export const toFormDataOrObject = (obj: Object) => {
    var fd = new FormData();
    var isJson = true;
    for (var property in obj) {
      if (obj[property] instanceof File) {
        isJson = false;
      }
      if (typeof obj[property] === 'object' && !(obj[property] instanceof File)) {
        fd.append(property, JSON.stringify(obj[property]));
      } else {
        fd.append(property, obj[property]);
      }
    }
    if (isJson) {
      return obj;
    }
    return fd;
};

`;

  for (var sock of sockets.objects) {
    allFile += endpoint(sock);
    allFile += '\n';
  }
  return allFile;
};

fetch(instanceUrl)
  .then((response) => response.json())
  .then((json) => generateFile(json))
  .then((contents) => fs.writeFile('./gen.ts', contents));
