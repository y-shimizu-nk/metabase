/* eslint-disable @typescript-eslint/no-unused-vars */
import { t } from "ttag";
import { useEffect, useMemo, useState } from "react";
import _ from "underscore";
import type {
  FilterTypeKeys,
  SearchFilterComponent,
  SearchFilterPropTypes,
  SearchFilters,
} from "metabase/search/types";
import Button from "metabase/core/components/Button";
import { Title, Flex } from "metabase/ui";
import { SearchFilterKeys } from "metabase/search/constants";
import { TypeFilter } from "./filters/TypeFilter";
import { SearchFilterWrapper } from "./SearchFilterSidebar.styled";

const filterMap: Record<FilterTypeKeys, SearchFilterComponent> = {
  [SearchFilterKeys.Type]: TypeFilter,
};

export const SearchFilterSidebar = ({
  value,
  onChangeFilters,
}: {
  value: SearchFilters;
  onChangeFilters: (filters: SearchFilters) => void;
}) => {
  const onOutputChange = (
    key: FilterTypeKeys,
    val: SearchFilterPropTypes[FilterTypeKeys],
  ) => {
    if (!val || val.length === 0) {
      onChangeFilters(_.omit(value, key));
    } else {
      onChangeFilters({
        ...value,
        [key]: val,
      });
    }
  };

  const getFilter = (key: FilterTypeKeys) => {
    const Filter = filterMap[key];
    return (
      <Filter
        key={key}
        data-testid={`${key}-search-filter`}
        value={value[key]}
        onChange={value => onOutputChange(key, value)}
      />
    );
  };

  return <Flex direction="column">{getFilter(SearchFilterKeys.Type)}</Flex>;
};
