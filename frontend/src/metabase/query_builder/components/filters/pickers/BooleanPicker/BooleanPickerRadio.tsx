import _ from "underscore";
import { useMemo } from "react";
import * as ML from "metabase-lib";

import { useToggle } from "metabase/hooks/use-toggle";

import { RadioContainer, Toggle, FilterRadio } from "./BooleanPicker.styled";

import { OPTIONS, EXPANDED_OPTIONS } from "./constants";

interface BooleanPickerProps {
  filter: ML.FilterClause;
  query: ML.Query;
  onFilterChange: (query: ML.Query) => void;
  className?: string;
}

function BooleanPicker({
  className,
  filter,
  query,
  onFilterChange,
}: BooleanPickerProps) {
  const { args } = ML.externalOp(filter);
  const [mlv2Column, value] = args;

  const [isExpanded, { toggle }] = useToggle(!_.isBoolean(value));

  const operatorsMap = useMemo(() => {
    const operators = ML.filterableColumnOperators(mlv2Column);

    return Object.fromEntries(
      operators.map((operator: ML.FilterOperator) => [
        ML.displayInfo(query, -1, operator).shortName,
        operator,
      ]),
    );
  }, [mlv2Column, query]);

  const updateFilter = (value: unknown) => {
    const operator = _.isBoolean(value)
      ? operatorsMap["="]
      : operatorsMap[value];
    const filterValue = _.isBoolean(value) ? value : undefined;

    const newFilterClause = ML.filterClause(operator, mlv2Column, filterValue);

    onFilterChange(newFilterClause);
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
