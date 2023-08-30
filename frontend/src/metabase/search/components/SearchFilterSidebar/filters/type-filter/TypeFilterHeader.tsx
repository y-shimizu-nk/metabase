import type { SearchSidebarFilterComponent } from "metabase/search/types";

export const TypeFilterHeader: SearchSidebarFilterComponent<"type">["Title"] =
  () => {
    return <div>Content Type</div>;
  };
