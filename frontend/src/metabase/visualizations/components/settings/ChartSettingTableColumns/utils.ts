import { checkNotNull } from "metabase/core/utils/types";
import { DatasetColumn, TableColumnOrderSetting } from "metabase-types/api";
import * as Lib from "metabase-lib";
import { getColumnKey } from "metabase-lib/queries/utils/get-column-key";
import { findColumnIndexForColumnSetting } from "metabase-lib/queries/utils/dataset";
import {
  ColumnGroupItem,
  ColumnMetadataItem,
  ColumnSetting,
  ColumnSettingItem,
  DragColumnProps,
  EditWidgetConfig,
} from "./types";

const STAGE_INDEX = -1;

export const getColumnSettingsWithRefs = (
  columnSettings: TableColumnOrderSetting[],
): ColumnSetting[] => {
  return columnSettings
    .filter(({ fieldRef }) => fieldRef != null)
    .map(columnSetting => ({
      ...columnSetting,
      fieldRef: checkNotNull(columnSetting.fieldRef),
    }));
};

export const getMetadataColumns = (query: Lib.Query): Lib.ColumnMetadata[] => {
  return Lib.visibleColumns(query, STAGE_INDEX);
};

export const getQueryColumnSettingItems = (
  query: Lib.Query,
  metadataColumns: Lib.ColumnMetadata[],
  datasetColumns: DatasetColumn[],
  columnSettings: ColumnSetting[],
): ColumnSettingItem[] => {
  const fieldRefs = columnSettings.map(({ fieldRef }) => fieldRef);
  const metadataIndexes = Lib.findColumnIndexesFromLegacyRefs(
    query,
    STAGE_INDEX,
    metadataColumns,
    fieldRefs,
  );
  const datasetIndexes = Lib.findColumnIndexesFromLegacyRefs(
    query,
    STAGE_INDEX,
    datasetColumns,
    fieldRefs,
  );

  return columnSettings
    .filter((columnSetting, columnIndex) => {
      const metadataIndex = metadataIndexes[columnIndex];
      const datasetIndex = datasetIndexes[columnIndex];
      return metadataIndex >= 0 && datasetIndex >= 0;
    })
    .map((columnSetting, columnIndex) => ({
      enabled: columnSetting.enabled,
      metadataColumn: metadataColumns[metadataIndexes[columnIndex]],
      datasetColumn: datasetColumns[datasetIndexes[columnIndex]],
      columnSettingIndex: columnIndex,
    }));
};

export const getDatasetColumnSettingItems = (
  datasetColumns: DatasetColumn[],
  columnSettings: ColumnSetting[],
): ColumnSettingItem[] => {
  const datasetIndexes = columnSettings.map(columnSetting =>
    findColumnIndexForColumnSetting(datasetColumns, columnSetting),
  );

  return columnSettings
    .filter((columnSetting, columnIndex) => {
      const datasetIndex = datasetIndexes[columnIndex];
      return datasetIndex >= 0;
    })
    .map((columnSetting, columnIndex) => ({
      enabled: columnSetting.enabled,
      datasetColumn: datasetColumns[datasetIndexes[columnIndex]],
      columnSettingIndex: columnIndex,
    }));
};

export const getAdditionalMetadataColumns = (
  metadataColumns: Lib.ColumnMetadata[],
  columnSettingItems: ColumnSettingItem[],
): Lib.ColumnMetadata[] => {
  const additionalColumns = new Set(metadataColumns);

  columnSettingItems.forEach(({ metadataColumn }) => {
    if (metadataColumn) {
      additionalColumns.delete(metadataColumn);
    }
  });

  return Array.from(additionalColumns);
};

const getColumnGroupName = (
  displayInfo: Lib.ColumnDisplayInfo | Lib.TableDisplayInfo,
) => {
  const columnInfo = displayInfo as Lib.ColumnDisplayInfo;
  const tableInfo = displayInfo as Lib.TableDisplayInfo;
  return columnInfo.fkReferenceName || tableInfo.displayName;
};

export const getColumnGroups = (
  query: Lib.Query,
  metadataColumns: Lib.ColumnMetadata[],
): ColumnGroupItem[] => {
  const groups = Lib.groupColumns(metadataColumns);

  return groups.map(group => {
    const displayInfo = Lib.displayInfo(query, STAGE_INDEX, group);
    const columns = Lib.getColumnsFromColumnGroup(group);

    return {
      columns: columns.map(column => {
        const displayInfo = Lib.displayInfo(query, STAGE_INDEX, column);
        return {
          column,
          name: displayInfo.name,
          displayName: displayInfo.displayName,
        };
      }),
      displayName: getColumnGroupName(displayInfo),
      isJoinable: displayInfo.isFromJoin || displayInfo.isImplicitlyJoinable,
    };
  });
};

export const getEditWidgetConfig = ({
  datasetColumn,
}: ColumnSettingItem): EditWidgetConfig | undefined => {
  return {
    id: "column_settings",
    props: { initialKey: getColumnKey(datasetColumn) },
  };
};

export const addColumnInQuery = (
  query: Lib.Query,
  { column }: ColumnMetadataItem,
) => {
  const displayInfo = Lib.displayInfo(query, STAGE_INDEX, column);
  return displayInfo.selected
    ? query
    : Lib.addField(query, STAGE_INDEX, column);
};

export const enableColumnInQuery = (
  query: Lib.Query,
  { metadataColumn }: ColumnSettingItem,
) => {
  if (!metadataColumn) {
    return query;
  }

  const displayInfo = Lib.displayInfo(query, STAGE_INDEX, metadataColumn);
  return displayInfo.selected
    ? query
    : Lib.addField(query, STAGE_INDEX, metadataColumn);
};

export const disableColumnInQuery = (
  query: Lib.Query,
  { metadataColumn }: ColumnSettingItem,
) => {
  if (!metadataColumn) {
    return query;
  }

  return Lib.removeField(query, STAGE_INDEX, metadataColumn);
};

const findColumnSettingIndex = (
  query: Lib.Query,
  column: Lib.ColumnMetadata,
  columnSettings: ColumnSetting[],
) => {
  const columnIndexes = Lib.findColumnIndexesFromLegacyRefs(
    query,
    STAGE_INDEX,
    [column],
    columnSettings.map(({ fieldRef }) => fieldRef),
  );

  return columnIndexes.findIndex(index => index >= 0);
};

export const addColumnInSettings = (
  query: Lib.Query,
  columnSettings: ColumnSetting[],
  { column, name }: ColumnMetadataItem,
): ColumnSetting[] => {
  const settingIndex = findColumnSettingIndex(query, column, columnSettings);

  const newSettings = [...columnSettings];
  if (settingIndex >= 0) {
    newSettings[settingIndex] = { ...newSettings[settingIndex], enabled: true };
  } else {
    const fieldRef = Lib.legacyFieldRef(column);
    newSettings.push({ name, fieldRef, enabled: true });
  }

  return newSettings;
};

export const enableColumnInSettings = (
  columnSettings: ColumnSetting[],
  { columnSettingIndex }: ColumnSettingItem,
) => {
  const newSettings = [...columnSettings];
  newSettings[columnSettingIndex] = {
    ...newSettings[columnSettingIndex],
    enabled: true,
  };

  return newSettings;
};

export const disableColumnInSettings = (
  columnSettings: ColumnSetting[],
  { columnSettingIndex }: ColumnSettingItem,
) => {
  const newSettings = [...columnSettings];
  newSettings[columnSettingIndex] = {
    ...newSettings[columnSettingIndex],
    enabled: false,
  };

  return newSettings;
};

export const moveColumnInSettings = (
  columnSettings: ColumnSetting[],
  enabledColumnItems: ColumnSettingItem[],
  { oldIndex, newIndex }: DragColumnProps,
) => {
  const adjustedOldIndex = enabledColumnItems[oldIndex].columnSettingIndex;
  const adjustedNewIndex = enabledColumnItems[newIndex].columnSettingIndex;

  const newSettings = [...columnSettings];
  newSettings.splice(
    adjustedNewIndex,
    0,
    newSettings.splice(adjustedOldIndex, 1)[0],
  );

  return newSettings;
};
