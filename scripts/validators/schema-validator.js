/**
 * Schema Validation Utilities
 * Provides runtime validation for data schemas across all dashboards
 */

/**
 * Base schema validator class
 */
class SchemaValidator {
  constructor(schemaName) {
    this.schemaName = schemaName;
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Add an error
   */
  addError(path, message) {
    this.errors.push({ path, message, schema: this.schemaName });
  }

  /**
   * Add a warning
   */
  addWarning(path, message) {
    this.warnings.push({ path, message, schema: this.schemaName });
  }

  /**
   * Check if validation passed
   */
  isValid() {
    return this.errors.length === 0;
  }

  /**
   * Get validation results
   */
  getResults() {
    return {
      valid: this.isValid(),
      errors: this.errors,
      warnings: this.warnings,
      schema: this.schemaName
    };
  }

  /**
   * Validate required fields
   */
  validateRequired(obj, fields, path = '') {
    fields.forEach(field => {
      if (!(field in obj)) {
        this.addError(`${path}.${field}`, `Missing required field: ${field}`);
      }
    });
  }

  /**
   * Validate field type
   */
  validateType(value, expectedType, path) {
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== expectedType) {
      this.addError(path, `Expected type ${expectedType}, got ${actualType}`);
      return false;
    }
    return true;
  }

  /**
   * Validate date format
   */
  validateDate(dateStr, path, format = 'YYYY-MM-DD') {
    if (format === 'YYYY-MM-DD') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        this.addError(path, `Invalid date format: expected YYYY-MM-DD, got ${dateStr}`);
        return false;
      }
    } else if (format === 'ISO8601') {
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(dateStr)) {
        this.addError(path, `Invalid ISO8601 timestamp: ${dateStr}`);
        return false;
      }
    }
    
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      this.addError(path, `Invalid date value: ${dateStr}`);
      return false;
    }
    
    return true;
  }

  /**
   * Validate number is non-negative
   */
  validateNonNegative(value, path) {
    if (typeof value !== 'number') {
      this.addError(path, `Expected number, got ${typeof value}`);
      return false;
    }
    if (value < 0) {
      this.addError(path, `Expected non-negative number, got ${value}`);
      return false;
    }
    if (!isFinite(value)) {
      this.addError(path, `Expected finite number, got ${value}`);
      return false;
    }
    if (isNaN(value)) {
      this.addError(path, `Expected valid number, got NaN`);
      return false;
    }
    return true;
  }

  /**
   * Validate number is within range
   */
  validateRange(value, min, max, path) {
    if (!this.validateNonNegative(value, path)) {
      return false;
    }
    if (value < min || value > max) {
      this.addError(path, `Value ${value} out of range [${min}, ${max}]`);
      return false;
    }
    return true;
  }

  /**
   * Validate string is not empty
   */
  validateNonEmptyString(value, path) {
    if (typeof value !== 'string') {
      this.addError(path, `Expected string, got ${typeof value}`);
      return false;
    }
    if (value.trim().length === 0) {
      this.addError(path, `Expected non-empty string`);
      return false;
    }
    return true;
  }

  /**
   * Validate array
   */
  validateArray(value, path, minLength = 0) {
    if (!Array.isArray(value)) {
      this.addError(path, `Expected array, got ${typeof value}`);
      return false;
    }
    if (value.length < minLength) {
      this.addError(path, `Array length ${value.length} less than minimum ${minLength}`);
      return false;
    }
    return true;
  }

  /**
   * Validate enum value
   */
  validateEnum(value, allowedValues, path) {
    if (!allowedValues.includes(value)) {
      this.addError(path, `Value '${value}' not in allowed values: ${allowedValues.join(', ')}`);
      return false;
    }
    return true;
  }

  /**
   * Check for NaN values recursively
   */
  checkNoNaN(obj, path = '') {
    for (const [key, value] of Object.entries(obj)) {
      const fullPath = path ? `${path}.${key}` : key;
      if (typeof value === 'number') {
        if (isNaN(value)) {
          this.addError(fullPath, `Found NaN value`);
        }
        if (!isFinite(value)) {
          this.addError(fullPath, `Found non-finite value`);
        }
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        this.checkNoNaN(value, fullPath);
      } else if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (typeof item === 'object' && item !== null) {
            this.checkNoNaN(item, `${fullPath}[${index}]`);
          } else if (typeof item === 'number' && (isNaN(item) || !isFinite(item))) {
            this.addError(`${fullPath}[${index}]`, `Found NaN or non-finite value`);
          }
        });
      }
    }
  }
}

/**
 * Validator for AI-Assisted Coding Efficiency data
 */
class AIAssistedEfficiencyValidator extends SchemaValidator {
  constructor() {
    super('AIAssistedEfficiency');
  }

  validate(data) {
    this.errors = [];
    this.warnings = [];

    // Validate top-level structure
    this.validateRequired(data, ['enterprise_report', 'user_report']);
    
    if (!data.enterprise_report || !data.user_report) {
      return this.getResults();
    }

    // Validate enterprise report
    this.validateRequired(data.enterprise_report, ['day_totals']);
    if (this.validateArray(data.enterprise_report.day_totals, 'enterprise_report.day_totals', 1)) {
      data.enterprise_report.day_totals.forEach((day, index) => {
        this.validateDayTotal(day, `enterprise_report.day_totals[${index}]`);
      });
    }

    // Validate user report
    if (this.validateArray(data.user_report, 'user_report')) {
      data.user_report.forEach((user, index) => {
        this.validateUserEntry(user, `user_report[${index}]`);
      });
    }

    // Check for NaN values
    this.checkNoNaN(data);

    return this.getResults();
  }

  validateDayTotal(day, path) {
    this.validateRequired(day, ['day', 'daily_active_users', 'user_initiated_interaction_count']);
    
    if (day.day) {
      this.validateDate(day.day, `${path}.day`);
    }
    
    if ('daily_active_users' in day) {
      this.validateNonNegative(day.daily_active_users, `${path}.daily_active_users`);
    }
    
    if ('user_initiated_interaction_count' in day) {
      this.validateNonNegative(day.user_initiated_interaction_count, `${path}.user_initiated_interaction_count`);
    }
    
    if ('code_generation_activity_count' in day && 'code_acceptance_activity_count' in day) {
      if (day.code_acceptance_activity_count > day.code_generation_activity_count) {
        this.addWarning(`${path}`, 'Acceptances exceed generations');
      }
    }
  }

  validateUserEntry(user, path) {
    this.validateRequired(user, ['day', 'user_login', 'daily_active_users']);
    
    if (user.day) {
      this.validateDate(user.day, `${path}.day`);
    }
    
    if (user.user_login) {
      this.validateNonEmptyString(user.user_login, `${path}.user_login`);
    }
    
    if ('daily_active_users' in user) {
      this.validateRange(user.daily_active_users, 0, 1, `${path}.daily_active_users`);
    }
  }
}

/**
 * Validator for Agentic AI Coding data
 */
class AgenticAIValidator extends SchemaValidator {
  constructor() {
    super('AgenticAI');
  }

  validate(data) {
    this.errors = [];
    this.warnings = [];

    // Validate top-level structure
    this.validateRequired(data, ['developer_day_summary', 'pr_sessions']);
    
    if (!data.developer_day_summary || !data.pr_sessions) {
      return this.getResults();
    }

    // Validate developer summaries
    if (this.validateArray(data.developer_day_summary, 'developer_day_summary', 1)) {
      data.developer_day_summary.forEach((dev, index) => {
        this.validateDeveloperSummary(dev, `developer_day_summary[${index}]`);
      });
    }

    // Validate PR sessions
    if (this.validateArray(data.pr_sessions, 'pr_sessions', 1)) {
      data.pr_sessions.forEach((pr, index) => {
        this.validatePRSession(pr, `pr_sessions[${index}]`);
      });
    }

    // Check for NaN values
    this.checkNoNaN(data);

    return this.getResults();
  }

  validateDeveloperSummary(dev, path) {
    this.validateRequired(dev, ['date', 'developer_login', 'total_agent_requests']);
    
    if (dev.date) {
      this.validateDate(dev.date, `${path}.date`);
    }
    
    if (dev.developer_login) {
      this.validateNonEmptyString(dev.developer_login, `${path}.developer_login`);
    }
    
    if ('total_agent_requests' in dev) {
      this.validateNonNegative(dev.total_agent_requests, `${path}.total_agent_requests`);
    }
    
    if ('agent_prs_created' in dev && 'agent_prs_merged' in dev) {
      if (dev.agent_prs_merged > dev.agent_prs_created) {
        this.addWarning(`${path}`, 'Merged PRs exceed created PRs');
      }
    }
  }

  validatePRSession(pr, path) {
    this.validateRequired(pr, ['repo', 'pr_number', 'pr_created_at', 'pr_state']);
    
    if (pr.pr_created_at) {
      this.validateDate(pr.pr_created_at, `${path}.pr_created_at`, 'ISO8601');
    }
    
    if (pr.pr_state) {
      this.validateEnum(pr.pr_state, ['open', 'closed', 'merged'], `${path}.pr_state`);
    }
    
    if ('pr_number' in pr) {
      if (!Number.isInteger(pr.pr_number) || pr.pr_number <= 0) {
        this.addError(`${path}.pr_number`, 'PR number must be positive integer');
      }
    }
  }
}

/**
 * Validator for Structural Quality data (PR reviews)
 */
class StructuralQualityValidator extends SchemaValidator {
  constructor() {
    super('StructuralQuality');
  }

  validate(data) {
    this.errors = [];
    this.warnings = [];

    // Validate top-level structure
    this.validateRequired(data, ['pull_requests']);
    
    if (!data.pull_requests) {
      return this.getResults();
    }

    // Validate PR array
    if (this.validateArray(data.pull_requests, 'pull_requests', 1)) {
      data.pull_requests.forEach((pr, index) => {
        this.validatePullRequest(pr, `pull_requests[${index}]`);
      });
    }

    // Check for NaN values
    this.checkNoNaN(data);

    return this.getResults();
  }

  validatePullRequest(pr, path) {
    this.validateRequired(pr, ['number', 'title', 'state', 'created_at', 'user']);
    
    if ('number' in pr) {
      if (!Number.isInteger(pr.number) || pr.number <= 0) {
        this.addError(`${path}.number`, 'PR number must be positive integer');
      }
    }
    
    if (pr.title) {
      this.validateNonEmptyString(pr.title, `${path}.title`);
    }
    
    if (pr.state) {
      this.validateEnum(pr.state, ['open', 'closed'], `${path}.state`);
    }
    
    if (pr.created_at) {
      this.validateDate(pr.created_at, `${path}.created_at`, 'ISO8601');
    }
    
    if (pr.user) {
      this.validateRequired(pr.user, ['login'], `${path}.user`);
    }
    
    if (pr.review_comments && Array.isArray(pr.review_comments)) {
      pr.review_comments.forEach((comment, cIndex) => {
        this.validateReviewComment(comment, `${path}.review_comments[${cIndex}]`);
      });
    }
  }

  validateReviewComment(comment, path) {
    this.validateRequired(comment, ['id', 'body', 'created_at', 'user']);
    
    if (comment.created_at) {
      this.validateDate(comment.created_at, `${path}.created_at`, 'ISO8601');
    }
  }
}

/**
 * Factory function to get the appropriate validator
 */
export function getValidator(type) {
  switch (type) {
    case 'ai-assisted-efficiency':
      return new AIAssistedEfficiencyValidator();
    case 'agentic-ai':
      return new AgenticAIValidator();
    case 'structural-quality':
      return new StructuralQualityValidator();
    default:
      throw new Error(`Unknown validator type: ${type}`);
  }
}

/**
 * Validate data and throw if invalid
 */
export function validateOrThrow(data, type) {
  const validator = getValidator(type);
  const results = validator.validate(data);
  
  if (!results.valid) {
    const errorMsg = `Schema validation failed for ${type}:\n${results.errors.map(e => `  - ${e.path}: ${e.message}`).join('\n')}`;
    throw new Error(errorMsg);
  }
  
  return results;
}

/**
 * Validate data and return results
 */
export function validate(data, type) {
  const validator = getValidator(type);
  return validator.validate(data);
}
