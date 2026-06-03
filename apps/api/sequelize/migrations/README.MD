Orden de Creación (up method)

Este orden asegura que cada tabla se crea después de todas las tablas a las que hace referencia a través de claves foráneas (FOREIGN KEY). Los ENUMs se crean justo antes de la primera tabla que los utiliza.

    companies (No depende de nadie)

    gas_stations (Depende de companies)

    currencies (No depende de nadie)

    users (Depende de gas_stations - asumiendo que un usuario siempre está asignado a una estación si el campo no es NULLABLE)

    employees (Depende de gas_stations y users)

    invoices (Depende de gas_stations y currencies)

    fuel_types (No depende de nadie)

    sale_type_configs (Depende de gas_stations, fuel_types y currencies)

    tank_models (No depende de nadie)

    tank_calibration_entries (Depende de tank_models)

    tanks (Depende de gas_stations, fuel_types y tank_models)

    dispatch_receptions (Depende de tanks, invoices y currencies)

    tank_assignments (Depende de tanks y dispatch_receptions)

    pump_islands (Depende de gas_stations)

    dispensers (Depende de pump_islands, gas_stations, fuel_types y tanks)

    dispenser_nozzles (Depende de dispensers)

    employee_shifts (Depende de employees y gas_stations)

        (Recuerda crear el ENUM enum_employee_shifts_employeeRole antes de esta tabla)

    dispenser_readings (Depende de dispenser_nozzles y employee_shifts)

        (Recuerda crear el ENUM enum_dispenser_readings_readingType antes de esta tabla)

    sales_tickets (Depende de gas_stations, employee_shifts, employees, dispenser_nozzles, fuel_types y sale_type_configs)

        (Recuerda crear el ENUM enum_sales_tickets_status antes de esta tabla)

    payments (Depende de sales_tickets y currencies)

        (Recuerda crear el ENUM enum_payments_paymentMethod antes de esta tabla)

    tank_measurements (Depende de tanks y employees)

        (Recuerda crear el ENUM enum_tank_measurements_measurementReason antes de esta tabla)


        Orden de Borrado (down method)

Este es simplemente el orden inverso del anterior. Cuando eliminas, debes eliminar primero las tablas que tienen claves foráneas que referencian a otras, y las tablas que son referenciadas se eliminan al final. Los ENUMs se borran después de la última tabla que los utilizaba.

    tank_measurements

        (Borrar el ENUM enum_tank_measurements_measurementReason después de esta tabla)

    payments

        (Borrar el ENUM enum_payments_paymentMethod después de esta tabla)

    sales_tickets

        (Borrar el ENUM enum_sales_tickets_status después de esta tabla)

    dispenser_readings

        (Borrar el ENUM enum_dispenser_readings_readingType después de esta tabla)

    employee_shifts

        (Borrar el ENUM enum_employee_shifts_employeeRole después de esta tabla)

    dispenser_nozzles

    dispensers

    pump_islands

    tank_assignments

    dispatch_receptions

    tanks

    tank_calibration_entries

    tank_models

    sale_type_configs

    fuel_types

    invoices

    employees

    users

    currencies

    gas_stations

    companies
