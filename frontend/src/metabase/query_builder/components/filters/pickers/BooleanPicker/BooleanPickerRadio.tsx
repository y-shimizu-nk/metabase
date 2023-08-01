import _ from "underscore";
import { useMemo } from "react";
import * as ML from "metabase-lib";

import { useToggle } from "metabase/hooks/use-toggle";
import Filter from "metabase-lib/queries/structured/Filter";

import { RadioContainer, Toggle, FilterRadio } from "./BooleanPicker.styled";

import { OPTIONS, EXPANDED_OPTIONS } from "./constants";

interface BooleanPickerProps {
  filter: Filter;
  onFilterChange: (filter: Filter) => void;
  className?: string;
}

function BooleanPicker({
  className,
  filter,
  onFilterChange,
}: BooleanPickerProps) {
  const [mlv2Filter, mlv2Query] = filter._getMLv2Filter();

  const { args } = ML.externalOp(mlv2Filter);
  const [mlv2Column, value] = args;

  const [isExpanded, { toggle }] = useToggle(!_.isBoolean(value));

  const operatorsMap = useMemo(() => {
    const operators = ML.filterableColumnOperators(mlv2Column);

    return Object.fromEntries(
      operators.map((operator: ML.FilterOperator) => [
        ML.displayInfo(mlv2Query, -1, operator).shortName,
        operator,
      ]),
    );
  }, [mlv2Column, mlv2Query]);

  const updateFilter = (value: unknown) => {
    const operator = _.isBoolean(value)
      ? operatorsMap["="]
      : operatorsMap[value];
    const filterValue = _.isBoolean(value) ? value : undefined;

    const newFilterClause = ML.filterClause(operator, mlv2Column, filterValue);

    onFilterChange(newFilterClause._toLegacyFilter());
  };

  return (
    <RadioContainer className={className}>
      <FilterRadio
        vertical
        colorScheme="accent7"
        options={isExpanded ? EXPANDED_OPTIONS : OPTIONS}
        value={value}
        onChange={updateFilter}
      />
      {!isExpanded && <Toggle onClick={toggle} />}
    </RadioContainer>
  );
}

// eslint-disable-next-line import/no-default-export -- deprecated usage
export default BooleanPicker;
