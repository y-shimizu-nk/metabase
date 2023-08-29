/* eslint-disable react/prop-types */
import { t } from "ttag";
import { getTranslatedEntityName } from "metabase/nav/utils";
import { Checkbox, Flex } from "metabase/ui";
import { useSearchListQuery } from "metabase/common/hooks";

import type { SearchFilterComponent } from "metabase/search/types";
import { enabledSearchTypes } from "metabase/search/constants";
import { DropdownSearchFilter } from "metabase/search/components/SearchFilterSidebar/dropdown-filter/DropdownSearchFilter";

const EMPTY_SEARCH_QUERY = { models: "dataset", limit: 1 } as const;

export const TypeFilter: SearchFilterComponent<"type"> = ({
  value = [],
  onChange,
  "data-testid": dataTestId,
}) => {
  const { metadata, isLoading } = useSearchListQuery({
    query: EMPTY_SEARCH_QUERY,
  });

  const availableModels = (metadata && metadata.available_models) ?? [];
  const typeFilters = availableModels.filter(model =>
    enabledSearchTypes.includes(model),
  );

  const getTitleText = () => {
    if (value.length === 1) {
      return getTranslatedEntityName(value[0]) ?? t`1 type selected`;
    } else if (value.length > 1) {
      return value.length + t` types selected`;
    }
    return t`Content type`;
  };

  return (
    <DropdownSearchFilter
      isLoading={isLoading}
      title={t`Content type`}
      value={value}
      onChange={onChange}
      data-testid={dataTestId}
      displayIcon="dashboard"
      displayText={getTitleText()}
    >
      {(data, updateData) => (
        <Checkbox.Group w="100%" value={data} onChange={updateData}>
          <Flex justify="center" align="flex-start" direction="column" gap="md">
            {typeFilters.map(model => (
              <Checkbox
                key={model}
                value={model}
                label={getTranslatedEntityName(model)}
              />
            ))}
          </Flex>
        </Checkbox.Group>
      )}
    </DropdownSearchFilter>
  );
};
