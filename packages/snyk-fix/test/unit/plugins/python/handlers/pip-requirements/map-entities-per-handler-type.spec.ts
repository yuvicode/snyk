import { mapEntitiesPerHandlerType } from '../../../../../../src/plugins/python/map-entities-per-handler-type';
import { SUPPORTED_HANDLER_TYPES } from '../../../../../../src/plugins/python/supported-handler-types';
import { generateEntityToFix } from '../../../../../helpers/generate-entity-to-fix';

describe('getHandlerType', () => {
  it('pip + requirements.txt is supported project type `requirements.txt`', () => {
    // Arrange
    const entity = generateEntityToFix(
      'pip',
      'requirements.txt',
      '-c constraints.txt',
    );

    // Act
    const res = mapEntitiesPerHandlerType([entity]);

    // Assert
    expect(
      res.entitiesPerType[SUPPORTED_HANDLER_TYPES.REQUIREMENTS],
    ).toHaveLength(1);
    expect(
      res.entitiesPerType[SUPPORTED_HANDLER_TYPES.REQUIREMENTS],
    ).toStrictEqual([entity]);
    expect(res.skipped).toStrictEqual([]);
  });

  it('pip + dev.txt is supported project type `requirements.txt`', () => {
    // Arrange
    const entity = generateEntityToFix('pip', 'dev.txt', 'django==1.6.1');

    // Act
    const res = mapEntitiesPerHandlerType([entity]);

    // Assert
    expect(
      res.entitiesPerType[SUPPORTED_HANDLER_TYPES.REQUIREMENTS],
    ).toHaveLength(1);
    expect(
      res.entitiesPerType[SUPPORTED_HANDLER_TYPES.REQUIREMENTS],
    ).toStrictEqual([entity]);
    expect(res.skipped).toStrictEqual([]);
  });

  it('pip + Pipfile is supported', () => {
    // Arrange
    const entity = generateEntityToFix('pip', 'Pipfile', '');
    // Act
    const res = mapEntitiesPerHandlerType([entity]);

    // Assert
    expect(res.entitiesPerType[SUPPORTED_HANDLER_TYPES.PIPFILE]).toHaveLength(
      1,
    );
    expect(res.entitiesPerType[SUPPORTED_HANDLER_TYPES.PIPFILE]).toStrictEqual([
      entity,
    ]);
    expect(res.skipped).toStrictEqual([]);
  });

  it('Pipfile & requirements.txt are supported', () => {
    // Arrange
    const entityPipfile = generateEntityToFix('pip', 'lib/Pipfile', '');
    const entityPipfileLock = generateEntityToFix(
      'pip',
      'lib/Pipfile.lock',
      '',
    );
    const entityRequirements = generateEntityToFix(
      'pip',
      'src/requirement.txt',
      '',
    );

    // Act
    const res = mapEntitiesPerHandlerType([
      entityPipfile,
      entityRequirements,
      entityPipfileLock,
    ]);

    // Assert
    expect(res.entitiesPerType[SUPPORTED_HANDLER_TYPES.PIPFILE]).toHaveLength(
      2,
    );
    expect(
      res.entitiesPerType[SUPPORTED_HANDLER_TYPES.REQUIREMENTS],
    ).toHaveLength(1);
    expect(res.entitiesPerType[SUPPORTED_HANDLER_TYPES.PIPFILE]).toStrictEqual([
      entityPipfile,
      entityPipfileLock,
    ]);
    expect(
      res.entitiesPerType[SUPPORTED_HANDLER_TYPES.REQUIREMENTS],
    ).toStrictEqual([entityRequirements]);
    expect(res.skipped).toStrictEqual([]);
  });
});
