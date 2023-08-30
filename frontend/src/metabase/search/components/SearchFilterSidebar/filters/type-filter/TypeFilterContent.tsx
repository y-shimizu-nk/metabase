/* eslint-disable react/prop-types */
import type { SearchSidebarFilterComponent } from "metabase/search/types";
import { useSearchListQuery } from "metabase/common/hooks";
import { enabledSearchTypes } from "metabase/search/constants";
import { Checkbox, Flex, Loader } from "metabase/ui";
import { getTranslatedEntityName } from "metabase/nav/utils";

const EMPTY_SEARCH_QUERY = { models: "dataset", limit: 1 } as const;
export const TypeFilterContent: SearchSidebarFilterComponent<"type">["Content"] =
  ({ value, onChange, "data-testid": dataTestId }) => {
    const { metadata, isLoading } = useSearchListQuery({
      query: EMPTY_SEARCH_QUERY,
    });

    const availableModels = (metadata && metadata.available_models) ?? [];
    const typeFilters = availableModels.filter(model =>
      enabledSearchTypes.includes(model),
    );

    return isLoading ? (
      <Loader />
    ) : (
      <Checkbox.Group w="100%" value={value} onChange={onChange}>
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
    );
  };
