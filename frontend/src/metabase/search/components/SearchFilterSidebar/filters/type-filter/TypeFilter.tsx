/* eslint-disable react/prop-types */
import type { SearchSidebarFilterComponent } from "metabase/search/types";
import { TypeFilterContent } from "metabase/search/components/SearchFilterSidebar/filters/type-filter/TypeFilterContent";
import { TypeFilterDisplay } from "metabase/search/components/SearchFilterSidebar/filters/type-filter/TypeFilterDisplay";
import { TypeFilterHeader } from "metabase/search/components/SearchFilterSidebar/filters/type-filter/TypeFilterHeader";

export const TypeFilter: SearchSidebarFilterComponent<"type"> = {
  Title: TypeFilterHeader,
  Display: TypeFilterDisplay,
  Content: TypeFilterContent,
};
