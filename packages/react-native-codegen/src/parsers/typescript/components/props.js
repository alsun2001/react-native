/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 * @format
 */

'use strict';

const {getSchemaInfo, getTypeAnnotation} = require('./componentsUtils.js');

import type {NamedShape, PropTypeAnnotation} from '../../../CodegenSchema.js';
import type {TypeDeclarationMap, PropAST} from '../../utils';
import type {ExtendsPropsShape} from '../../../CodegenSchema.js';
import type {Parser} from '../../parser';

const {flattenProperties} = require('./componentsUtils.js');
const {parseTopLevelType} = require('../parseTopLevelType');
const {extendsForProp} = require('../../parsers-commons');

function buildPropSchema(
  property: PropAST,
  types: TypeDeclarationMap,
): NamedShape<PropTypeAnnotation> {
  const info = getSchemaInfo(property, types);
  const {name, optional, typeAnnotation, defaultValue} = info;
  return {
    name,
    optional,
    typeAnnotation: getTypeAnnotation(
      name,
      typeAnnotation,
      defaultValue,
      types,
      buildPropSchema,
    ),
  };
}

function isEvent(typeAnnotation: $FlowFixMe): boolean {
  if (typeAnnotation.type !== 'TSTypeReference') {
    return false;
  }
  const eventNames = new Set(['BubblingEventHandler', 'DirectEventHandler']);
  return eventNames.has(typeAnnotation.typeName.name);
}

function isProp(name: string, typeAnnotation: $FlowFixMe): boolean {
  if (typeAnnotation.type !== 'TSTypeReference') {
    return true;
  }
  const isStyle =
    name === 'style' &&
    typeAnnotation.type === 'GenericTypeAnnotation' &&
    typeAnnotation.typeName.name === 'ViewStyleProp';
  return !isStyle;
}

function getProps(
  typeDefinition: $ReadOnlyArray<PropAST>,
  types: TypeDeclarationMap,
  parser: Parser,
): {
  props: $ReadOnlyArray<NamedShape<PropTypeAnnotation>>,
  extendsProps: $ReadOnlyArray<ExtendsPropsShape>,
} {
  const extendsProps: Array<ExtendsPropsShape> = [];
  const componentPropAsts: Array<PropAST> = [];
  const remaining: Array<PropAST> = [];

  for (const prop of typeDefinition) {
    // find extends
    if (prop.type === 'TSExpressionWithTypeArguments') {
      const extend = extendsForProp(prop, types, parser);
      if (extend) {
        extendsProps.push(extend);
        continue;
      }
    }

    remaining.push(prop);
  }

  // find events and props
  for (const prop of flattenProperties(remaining, types)) {
    const topLevelType = parseTopLevelType(
      prop.typeAnnotation.typeAnnotation,
      types,
    );

    if (
      prop.type === 'TSPropertySignature' &&
      !isEvent(topLevelType.type) &&
      isProp(prop.key.name, prop)
    ) {
      componentPropAsts.push(prop);
    }
  }

  return {
    props: componentPropAsts.map(property => buildPropSchema(property, types)),
    extendsProps,
  };
}

module.exports = {
  getProps,
};
