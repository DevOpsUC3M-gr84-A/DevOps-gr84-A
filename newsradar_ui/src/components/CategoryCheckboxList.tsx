import React, { memo } from "react";
import type { AlertCategoryOption } from "./AlertForm";

interface CategoryCheckboxListProps {
  categories: AlertCategoryOption[];
  selectedCategoriesIds: string[];
  onToggle: (code: string, event: React.ChangeEvent<HTMLInputElement>) => void;
}

/**
 * Componente memorizado para optimizar el renderizado de la lista de categorías.
 * Evita re-renders innecesarios cuando cambian otras partes del formulario.
 */
export const CategoryCheckboxList = memo<CategoryCheckboxListProps>(
  ({
    categories,
    selectedCategoriesIds,
    onToggle,
  }) => {
    return (
      <fieldset className="categories-checkbox-list">
        <legend className="visually-hidden">CATEGORIA IPTC (NIVEL 1)</legend>
        {categories.map((category) => {
          const code = String(category.iptc_code ?? category.id ?? "");
          const label = String(
            category.name ?? category.iptc_label ?? code,
          );
          const checkboxId = `alertIptcCategory-${code}`;
          const isChecked = selectedCategoriesIds.includes(code);

          return (
            <div key={code || label} className="category-checkbox-row">
              <input
                id={checkboxId}
                type="checkbox"
                className="category-checkbox-input"
                checked={isChecked}
                onChange={(event) => onToggle(code, event)}
                aria-label={`Seleccionar ${label}`}
              />
              <label htmlFor={checkboxId} className="category-checkbox-label">
                {label}
              </label>
            </div>
          );
        })}
      </fieldset>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison para evitar re-renders innecesarios
    return (
      prevProps.categories === nextProps.categories &&
      prevProps.selectedCategoriesIds === nextProps.selectedCategoriesIds &&
      prevProps.onToggle === nextProps.onToggle
    );
  }
);

CategoryCheckboxList.displayName = "CategoryCheckboxList";
