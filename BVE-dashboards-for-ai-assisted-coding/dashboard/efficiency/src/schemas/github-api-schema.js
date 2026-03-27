/**
 * GitHub Copilot API Schema Validators
 * Based on official GitHub documentation:
 * https://docs.github.com/en/copilot/reference/copilot-usage-metrics/example-schema
 */

/**
 * Validate version info structure
 */
function validateVersionInfo(obj, context) {
  const errors = [];
  if (obj == null) return errors; // Optional field
  
  if (typeof obj !== 'object') {
    errors.push(`${context}: expected object, got ${typeof obj}`);
    return errors;
  }
  
  // All version fields are optional but must be strings if present
  const stringFields = ['cli_version', 'ide_version', 'plugin', 'plugin_version'];
  for (const field of stringFields) {
    if (obj[field] !== undefined && typeof obj[field] !== 'string') {
      errors.push(`${context}.${field}: expected string, got ${typeof obj[field]}`);
    }
  }
  
  if (obj.sampled_at !== undefined && typeof obj.sampled_at !== 'string') {
    errors.push(`${context}.sampled_at: expected ISO string, got ${typeof obj.sampled_at}`);
  }
  
  return errors;
}

/**
 * Validate token usage structure
 */
function validateTokenUsage(obj, context) {
  const errors = [];
  if (obj == null) return errors; // Optional field
  
  if (typeof obj !== 'object') {
    errors.push(`${context}: expected object, got ${typeof obj}`);
    return errors;
  }
  
  const numericFields = ['avg_tokens_per_request', 'output_tokens_sum', 'prompt_tokens_sum'];
  for (const field of numericFields) {
    if (obj[field] !== undefined && typeof obj[field] !== 'number') {
      errors.push(`${context}.${field}: expected number, got ${typeof obj[field]}`);
    }
  }
  
  return errors;
}

/**
 * Validate CLI totals structure
 */
function validateCLITotals(obj, context) {
  const errors = [];
  if (obj == null) return errors; // Optional field
  
  if (typeof obj !== 'object') {
    errors.push(`${context}: expected object, got ${typeof obj}`);
    return errors;
  }
  
  errors.push(...validateVersionInfo(obj.last_known_cli_version, `${context}.last_known_cli_version`));
  
  const numericFields = ['prompt_count', 'request_count', 'session_count'];
  for (const field of numericFields) {
    if (obj[field] !== undefined && typeof obj[field] !== 'number') {
      errors.push(`${context}.${field}: expected number, got ${typeof obj[field]}`);
    }
  }
  
  errors.push(...validateTokenUsage(obj.token_usage, `${context}.token_usage`));
  
  return errors;
}

/**
 * Validate IDE totals entry
 */
function validateIDETotal(obj, context) {
  const errors = [];
  
  if (typeof obj !== 'object') {
    errors.push(`${context}: expected object, got ${typeof obj}`);
    return errors;
  }
  
  // Required fields
  const requiredNumeric = [
    'code_acceptance_activity_count',
    'code_generation_activity_count',
    'loc_added_sum',
    'loc_deleted_sum',
    'loc_suggested_to_add_sum',
    'loc_suggested_to_delete_sum',
    'user_initiated_interaction_count'
  ];
  
  for (const field of requiredNumeric) {
    if (typeof obj[field] !== 'number') {
      errors.push(`${context}.${field}: expected number, got ${typeof obj[field]}`);
    }
  }
  
  if (obj.ide !== undefined && typeof obj.ide !== 'string') {
    errors.push(`${context}.ide: expected string, got ${typeof obj.ide}`);
  }
  
  errors.push(...validateVersionInfo(obj.last_known_ide_version, `${context}.last_known_ide_version`));
  errors.push(...validateVersionInfo(obj.last_known_plugin_version, `${context}.last_known_plugin_version`));
  
  return errors;
}

/**
 * Validate feature totals entry
 */
function validateFeatureTotal(obj, context) {
  const errors = [];
  
  if (typeof obj !== 'object') {
    errors.push(`${context}: expected object, got ${typeof obj}`);
    return errors;
  }
  
  const requiredNumeric = [
    'code_acceptance_activity_count',
    'code_generation_activity_count',
    'loc_added_sum',
    'loc_deleted_sum',
    'loc_suggested_to_add_sum',
    'loc_suggested_to_delete_sum'
  ];
  
  for (const field of requiredNumeric) {
    if (typeof obj[field] !== 'number') {
      errors.push(`${context}.${field}: expected number, got ${typeof obj[field]}`);
    }
  }
  
  if (obj.feature !== undefined && typeof obj.feature !== 'string') {
    errors.push(`${context}.feature: expected string, got ${typeof obj.feature}`);
  }
  
  return errors;
}

/**
 * Validate language feature totals entry
 */
function validateLanguageFeatureTotal(obj, context) {
  const errors = [];
  
  if (typeof obj !== 'object') {
    errors.push(`${context}: expected object, got ${typeof obj}`);
    return errors;
  }
  
  const requiredNumeric = [
    'code_acceptance_activity_count',
    'code_generation_activity_count',
    'loc_added_sum',
    'loc_deleted_sum',
    'loc_suggested_to_add_sum',
    'loc_suggested_to_delete_sum'
  ];
  
  for (const field of requiredNumeric) {
    if (typeof obj[field] !== 'number') {
      errors.push(`${context}.${field}: expected number, got ${typeof obj[field]}`);
    }
  }
  
  if (obj.language !== undefined && typeof obj.language !== 'string') {
    errors.push(`${context}.language: expected string, got ${typeof obj.language}`);
  }
  
  if (obj.feature !== undefined && typeof obj.feature !== 'string') {
    errors.push(`${context}.feature: expected string, got ${typeof obj.feature}`);
  }
  
  return errors;
}

/**
 * Validate pull request totals structure
 */
function validatePullRequestTotals(obj, context) {
  const errors = [];
  if (obj == null) return errors; // Optional field
  
  if (typeof obj !== 'object') {
    errors.push(`${context}: expected object, got ${typeof obj}`);
    return errors;
  }
  
  const numericFields = [
    'total_reviewed',
    'total_created',
    'total_created_by_copilot',
    'total_reviewed_by_copilot'
  ];
  
  for (const field of numericFields) {
    if (obj[field] !== undefined && typeof obj[field] !== 'number') {
      errors.push(`${context}.${field}: expected number, got ${typeof obj[field]}`);
    }
  }
  
  return errors;
}

/**
 * Validate a single user-level record (from user report API)
 */
export function validateUserRecord(record, index = 0) {
  const errors = [];
  const context = `record[${index}]`;
  
  if (!record || typeof record !== 'object') {
    return [`${context}: expected object, got ${typeof record}`];
  }
  
  // Required fields
  if (typeof record.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(record.day)) {
    errors.push(`${context}.day: expected YYYY-MM-DD format, got "${record.day}"`);
  }
  
  const requiredNumeric = [
    'code_acceptance_activity_count',
    'code_generation_activity_count',
    'loc_added_sum',
    'loc_deleted_sum',
    'loc_suggested_to_add_sum',
    'loc_suggested_to_delete_sum',
    'user_initiated_interaction_count'
  ];
  
  for (const field of requiredNumeric) {
    if (typeof record[field] !== 'number') {
      errors.push(`${context}.${field}: expected number, got ${typeof record[field]}`);
    }
  }
  
  // User identification
  if (record.user_id !== undefined && typeof record.user_id !== 'number') {
    errors.push(`${context}.user_id: expected number, got ${typeof record.user_id}`);
  }
  
  if (record.user_login !== undefined && typeof record.user_login !== 'string') {
    errors.push(`${context}.user_login: expected string, got ${typeof record.user_login}`);
  }
  
  // Boolean flags
  const boolFields = ['used_agent', 'used_chat', 'used_cli'];
  for (const field of boolFields) {
    if (record[field] !== undefined && typeof record[field] !== 'boolean') {
      errors.push(`${context}.${field}: expected boolean, got ${typeof record[field]}`);
    }
  }
  
  // Nested structures
  errors.push(...validateCLITotals(record.totals_by_cli, `${context}.totals_by_cli`));
  
  if (Array.isArray(record.totals_by_ide)) {
    record.totals_by_ide.forEach((ide, i) => {
      errors.push(...validateIDETotal(ide, `${context}.totals_by_ide[${i}]`));
    });
  } else if (record.totals_by_ide !== undefined) {
    errors.push(`${context}.totals_by_ide: expected array, got ${typeof record.totals_by_ide}`);
  }
  
  if (Array.isArray(record.totals_by_feature)) {
    record.totals_by_feature.forEach((feat, i) => {
      errors.push(...validateFeatureTotal(feat, `${context}.totals_by_feature[${i}]`));
    });
  } else if (record.totals_by_feature !== undefined) {
    errors.push(`${context}.totals_by_feature: expected array, got ${typeof record.totals_by_feature}`);
  }
  
  if (Array.isArray(record.totals_by_language_feature)) {
    record.totals_by_language_feature.forEach((lf, i) => {
      errors.push(...validateLanguageFeatureTotal(lf, `${context}.totals_by_language_feature[${i}]`));
    });
  } else if (record.totals_by_language_feature !== undefined) {
    errors.push(`${context}.totals_by_language_feature: expected array, got ${typeof record.totals_by_language_feature}`);
  }
  
  return errors;
}

/**
 * Validate a single day total record (from enterprise report API)
 */
export function validateDayTotal(dayTotal, index = 0) {
  const errors = [];
  const context = `day_total[${index}]`;
  
  if (!dayTotal || typeof dayTotal !== 'object') {
    return [`${context}: expected object, got ${typeof dayTotal}`];
  }
  
  // Required fields
  if (typeof dayTotal.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dayTotal.day)) {
    errors.push(`${context}.day: expected YYYY-MM-DD format, got "${dayTotal.day}"`);
  }
  
  const requiredNumeric = [
    'code_acceptance_activity_count',
    'code_generation_activity_count',
    'loc_added_sum',
    'loc_deleted_sum',
    'loc_suggested_to_add_sum',
    'loc_suggested_to_delete_sum',
    'user_initiated_interaction_count'
  ];
  
  for (const field of requiredNumeric) {
    if (typeof dayTotal[field] !== 'number') {
      errors.push(`${context}.${field}: expected number, got ${typeof dayTotal[field]}`);
    }
  }
  
  // Optional numeric fields
  const optionalNumeric = [
    'daily_active_users',
    'daily_active_cli_users',
    'weekly_active_users',
    'monthly_active_users',
    'monthly_active_chat_users',
    'monthly_active_agent_users'
  ];
  
  for (const field of optionalNumeric) {
    if (dayTotal[field] !== undefined && typeof dayTotal[field] !== 'number') {
      errors.push(`${context}.${field}: expected number, got ${typeof dayTotal[field]}`);
    }
  }
  
  // Nested structures
  errors.push(...validateCLITotals(dayTotal.totals_by_cli, `${context}.totals_by_cli`));
  errors.push(...validatePullRequestTotals(dayTotal.pull_requests, `${context}.pull_requests`));
  
  if (Array.isArray(dayTotal.totals_by_ide)) {
    dayTotal.totals_by_ide.forEach((ide, i) => {
      errors.push(...validateIDETotal(ide, `${context}.totals_by_ide[${i}]`));
    });
  } else if (dayTotal.totals_by_ide !== undefined) {
    errors.push(`${context}.totals_by_ide: expected array, got ${typeof dayTotal.totals_by_ide}`);
  }
  
  if (Array.isArray(dayTotal.totals_by_feature)) {
    dayTotal.totals_by_feature.forEach((feat, i) => {
      errors.push(...validateFeatureTotal(feat, `${context}.totals_by_feature[${i}]`));
    });
  } else if (dayTotal.totals_by_feature !== undefined) {
    errors.push(`${context}.totals_by_feature: expected array, got ${typeof dayTotal.totals_by_feature}`);
  }
  
  return errors;
}

/**
 * Validate user report API response (array of user records)
 */
export function validateUserReport(data) {
  if (!Array.isArray(data)) {
    return {
      valid: false,
      errors: [`Expected array for user report, got ${typeof data}`]
    };
  }
  
  const errors = [];
  data.forEach((record, i) => {
    errors.push(...validateUserRecord(record, i));
  });
  
  return {
    valid: errors.length === 0,
    errors,
    recordCount: data.length
  };
}

/**
 * Validate enterprise report API response
 */
export function validateEnterpriseReport(data) {
  const errors = [];
  
  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      errors: [`Expected object for enterprise report, got ${typeof data}`]
    };
  }
  
  if (!Array.isArray(data.day_totals)) {
    errors.push(`enterprise_report.day_totals: expected array, got ${typeof data.day_totals}`);
  } else {
    data.day_totals.forEach((dayTotal, i) => {
      errors.push(...validateDayTotal(dayTotal, i));
    });
  }
  
  return {
    valid: errors.length === 0,
    errors,
    dayCount: Array.isArray(data.day_totals) ? data.day_totals.length : 0
  };
}

/**
 * Validate raw API data from file (detects structure and validates)
 */
export function validateAPIData(data) {
  if (!data) {
    return {
      valid: false,
      errors: ['No data provided'],
      type: 'unknown'
    };
  }
  
  // Detect structure type
  if (Array.isArray(data)) {
    // Could be user report
    if (data.length > 0 && data[0].user_login) {
      return {
        ...validateUserReport(data),
        type: 'user_report'
      };
    }
    return {
      valid: false,
      errors: ['Array data does not match user report schema'],
      type: 'unknown'
    };
  }
  
  if (typeof data === 'object') {
    // Could be enterprise report
    if (data.day_totals) {
      return {
        ...validateEnterpriseReport(data),
        type: 'enterprise_report'
      };
    }
    return {
      valid: false,
      errors: ['Object data does not match enterprise report schema'],
      type: 'unknown'
    };
  }
  
  return {
    valid: false,
    errors: [`Unexpected data type: ${typeof data}`],
    type: 'unknown'
  };
}
