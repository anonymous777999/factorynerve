OCR TARGET ARCHITECTURE BIBLE
What is the OCR Platform?
The FactoryNerve OCR Platform is an intelligent document processing system that transforms physical documents into structured, actionable digital data. It serves as the core document intelligence engine that enables automated data extraction, validation, and integration across factory operations, supply chain management, and administrative workflows.
Why Does it Exist?
The OCR Platform exists to eliminate manual data entry from paper-based factory documents, reduce human error, accelerate processing times, enable real-time data access, and provide the foundation for data-driven decision making in manufacturing operations. It bridges the gap between physical documentation and digital factory systems.
What are its Responsibilities?
The OCR Platform is responsible for:
- Accepting physical document images (scans, photos) as input
- Automatically identifying document types (invoices, delivery notes, weighbridge tickets, etc.)
- Extracting structured data from documents with high accuracy
- Validating extracted data against business rules and document semantics
- Providing confidence scores for all extracted fields
- Enabling human review and correction when needed
- Exporting validated data to downstream systems (ERP, accounting, inventory)
- Maintaining audit trails for compliance and traceability
- Supporting continuous learning from user corrections
- Scaling to handle high volumes of documents in factory environments
What are its Boundaries?
The OCR Platform boundaries are defined by:
- Input: Accepts image files (PNG, JPG, PDF, TIFF) of physical documents
- Core Processing: Performs document classification, OCR extraction, validation, and enrichment
- Output: Provides structured JSON data with metadata, confidence scores, and validation results
- Integration Points: Connects to factory systems via APIs, webhooks, or direct database writes
- Exclusions: Does not include ERP functionality, inventory management, or financial processing - these are handled by downstream systems
What Components Exist?
The OCR Platform consists of these core components:
Core Services Layer
 1. Pre-flight Analysis Service - Analyzes image quality, detects scripts, estimates layout
 2. Document Classification Service - Identifies document type using text and visual features
 3. Document Registry - Central repository of document type definitions, schemas, and processing rules
 4. Prompt Engineering Service - Generates type-optimized prompts for OCR engines
 5. OCR Engine Abstraction Layer - Pluggable interface supporting multiple OCR technologies
 6. Validation Pipeline - Multi-stage validation (structural, schema, business, semantic)
 7. Confidence Calibration Service - Ensures confidence scores reflect true accuracy
 8. Response Building Service - Constructs standardized OCR result format
 9. Preprocessing Service - Applies image enhancements optimized per document type
10. Post-processing Service - Applies language models and corrections to raw OCR output
Infrastructure Layer
11. Caching Layer - Redis-based caching for frequent document types
12. Message Queue - Enables asynchronous processing and load leveling
13. Worker Pools - Specialized CPU/GPU workers for different processing stages
14. Monitoring & Telemetry - Collects metrics, traces, and logs for observability
15. Security Layer - Handles encryption, access controls, and compliance
16. Configuration Management - Centralized feature flags and settings
17. Feedback Collection - Captures user corrections for continuous learning
Presentation Layer
18. Adaptive Rendering Engine - Selects appropriate UI based on document complexity
19. Review Workflow Manager - Coordinates human-in-the-loop processes
20. Export Engine - Generates outputs in multiple formats (Excel, PDF, JSON, XML)
How Do Components Communicate?
Components communicate through well-defined interfaces:
- Service-to-Service: REST/gRPC APIs with protobuf or JSON payloads
- Internal Messaging: Asynchronous message queues for decoupled processing
- Shared State: Distributed cache (Redis) for temporary results and session data
- Events: Event-driven architecture for status updates and triggering workflows
- Synchronous Calls: Direct service calls for low-latency, request-response interactions
What Services Exist?
The platform provides these core services:
- Document Ingestion Service - Accepts and validates incoming document images
- Classification Service - Determines document type with confidence scores
- OCR Orchestration Service - Manages the end-to-end processing pipeline
- Validation Service - Applies multi-layer validation rules
- Enrichment Service - Adds contextual information and corrections
- Response Service - Formats output for consumption by clients
- Feedback Service - Collects and processes user corrections
- Monitoring Service - Exposes metrics and health checks
- Security Service - Manages authentication, authorization, and encryption
- Configuration Service - Provides runtime configuration and feature flags
What Modules Exist?
The platform is organized into these functional modules:
- ingestion - Document intake and initial validation
- analysis - Image preprocessing and quality assessment
- classification - Document type identification
- registry - Document type definitions and processing rules
- prompt - Prompt generation and management
- ocr - OCR engine abstraction and execution
- validation - Data validation and business rule enforcement
- response - Result formatting and enrichment
- presentation - UI rendering and user interaction
- infrastructure - Caching, queuing, worker management
- observability - Logging, metrics, tracing, alerting
- security - Authentication, authorization, encryption, compliance
- feedback - Learning from user corrections
What Abstractions Exist?
Key abstractions in the platform include:
- OCREngine Interface - Standard contract for all OCR implementations
- DocumentTypeConfig - Metadata-driven definition of document types
- ValidationRule - Composable validation logic
- ProcessingPipeline - Configurable sequence of processing steps
- ConfidenceScore - Standardized confidence representation
- OCRResult - Standardized output format for all processing
- FeatureFlag - Runtime toggle for functionality
- ProcessingContext - Immutable context passed through pipeline stages
How is Extensibility Achieved?
Extensibility is achieved through:
- Plugin Architecture - New OCR engines implement the OCREngine interface
- Registry-Driven Configuration - New document types added via configuration
OCR TARGET ARCHITECTURE BIBLE
What is the OCR Platform?
The FactoryNerve OCR Platform is an intelligent document processing system that transforms physical documents into structured, actionable digital data. It serves as the core document intelligence engine that enables automated data extraction, validation, and integration across factory operations, supply chain management, and administrative workflows.
Why Does it Exist?
The OCR Platform exists to eliminate manual data entry from paper-based factory documents, reduce human error, accelerate processing times, enable real-time data access, and provide the foundation for data-driven decision making in manufacturing operations. It bridges the gap between physical documentation and digital factory systems.
What are its Responsibilities?
The OCR Platform is responsible for:
- Accepting physical document images (scans, photos) as input
- Automatically identifying document types (invoices, delivery notes, weighbridge tickets, etc.)
- Extracting structured data from documents with high accuracy
- Validating extracted data against business rules and document semantics
- Providing confidence scores for all extracted fields
- Enabling human review and correction when needed
- Exporting validated data to downstream systems (ERP, accounting, inventory)
- Maintaining audit trails for compliance and traceability
- Supporting continuous learning from user corrections
- Scaling to handle high volumes of documents in factory environments
What are its Boundaries?
The OCR Platform boundaries are defined by:
- Input: Accepts image files (PNG, JPG, PDF, TIFF) of physical documents
- Core Processing: Performs document classification, OCR extraction, validation, and enrichment
- Output: Provides structured JSON data with metadata, confidence scores, and validation results
- Integration Points: Connects to factory systems via APIs, webhooks, or direct database writes
- Exclusions: Does not include ERP functionality, inventory management, or financial processing - these are handled by downstream systems
What Components Exist?
The OCR Platform consists of these core components:
Core Services Layer
 1. Pre-flight Analysis Service - Analyzes image quality, detects scripts, estimates layout
 2. Document Classification Service - Identifies document type using text and visual features
 3. Document Registry - Central repository of document type definitions, schemas, and processing rules
 4. Prompt Engineering Service - Generates type-optimized prompts for OCR engines
 5. OCR Engine Abstraction Layer - Pluggable interface supporting multiple OCR technologies
 6. Validation Pipeline - Multi-stage validation (structural, schema, business, semantic)
 7. Confidence Calibration Service - Ensures confidence scores reflect true accuracy
 8. Response Building Service - Constructs standardized OCR result format
 9. Preprocessing Service - Applies image enhancements optimized per document type
10. Post-processing Service - Applies language models and corrections to raw OCR output
Infrastructure Layer
11. Caching Layer - Redis-based caching for frequent document types
12. Message Queue - Enables asynchronous processing and load leveling
13. Worker Pools - Specialized CPU/GPU workers for different processing stages
14. Monitoring & Telemetry - Collects metrics, traces, and logs for observability
15. Security Layer - Handles encryption, access controls, and compliance
16. Configuration Management - Centralized feature flags and settings
17. Feedback Collection - Captures user corrections for continuous learning
Presentation Layer
18. Adaptive Rendering Engine - Selects appropriate UI based on document complexity
19. Review Workflow Manager - Coordinates human-in-the-loop processes
20. Export Engine - Generates outputs in multiple formats (Excel, PDF, JSON, XML)
How Do Components Communicate?
Components communicate through well-defined interfaces:
- Service-to-Service: REST/gRPC APIs with protobuf or JSON payloads
- Internal Messaging: Asynchronous message queues for decoupled processing
- Shared State: Distributed cache (Redis) for temporary results and session data
- Events: Event-driven architecture for status updates and triggering workflows
- Synchronous Calls: Direct service calls for low-latency, request-response interactions
What Services Exist?
The platform provides these core services:
- Document Ingestion Service - Accepts and validates incoming document images
- Classification Service - Determines document type with confidence scores
- OCR Orchestration Service - Manages the end-to-end processing pipeline
- Validation Service - Applies multi-layer validation rules
- Enrichment Service - Adds contextual information and corrections
- Response Service - Formats output for consumption by clients
- Feedback Service - Collects and processes user corrections
- Monitoring Service - Exposes metrics and health checks
- Security Service - Manages authentication, authorization, and encryption
- Configuration Service - Provides runtime configuration and feature flags
What Modules Exist?
The platform is organized into these functional modules:
- ingestion - Document intake and initial validation
- analysis - Image preprocessing and quality assessment
- classification - Document type identification
- registry - Document type definitions and processing rules
- prompt - Prompt generation and management
- ocr - OCR engine abstraction and execution
- validation - Data validation and business rule enforcement
- response - Result formatting and enrichment
- presentation - UI rendering and user interaction
- infrastructure - Caching, queuing, worker management
- observability - Logging, metrics, tracing, alerting
- security - Authentication, authorization, encryption, compliance
- feedback - Learning from user corrections
What Abstractions Exist?
Key abstractions in the platform include:
- OCREngine Interface - Standard contract for all OCR implementations
- DocumentTypeConfig - Metadata-driven definition of document types
- ValidationRule - Composable validation logic
- ProcessingPipeline - Configurable sequence of processing steps
- ConfidenceScore - Standardized confidence representation
- OCRResult - Standardized output format for all processing
- FeatureFlag - Runtime toggle for functionality
- ProcessingContext - Immutable context passed through pipeline stages
How is Extensibility Achieved?
Extensibility is achieved through:
- Plugin Architecture - New OCR engines implement the OCREngine interface
- Registry-Driven Configuration - New document types added via configuration files without code changes
- Versioned APIs - Backward compatible service interfaces
- Metadata-Driven Behavior - UI, validation, and processing rules driven from document registry
- Hook System - Extension points for custom validation, enrichment, and export logic
- Template System - Customizable prompts and response formats per document type
How is Maintainability Achieved?
Maintainability is achieved through:
- Separation of Concerns - Clear boundaries between services with single responsibilities
- Interface Stability - Well-defined, versioned contracts between components
- Configuration Over Convention - Behavior driven from external configuration
- Observability-First Design - Comprehensive logging, metrics, and tracing built-in
- Automated Testing - High test coverage with contract testing between services
- Documentation as Code - API specifications and architecture decisions stored with code
- Feature Flags - Safe deployment and rollback capabilities
- Modular Deployment - Independent scaling and updating of services
How are New Document Types Added?
New document types are added through:
1. Registry Entry - Create a new entry in the document registry with:
- Document type ID and name
- UI component mapping
- Extraction prompt template
- JSON schema for expected output
- Validation rules (required fields, value ranges, cross-field checks)
- Business rules (format validations, custom logic)
- UI configuration (field grouping, sections, repeatable sections)
- Export rules (format, column mapping, sheet names)
- Preprocessing profile (optimized image enhancements)
- Confidence thresholds (auto-accept, review required)
- Feature flags (type-specific capabilities)
2. UI Component (Optional) - Create specialized UI component for complex document types
3. Validation Rules (Optional) - Add custom validation logic if needed
4. No Code Changes Required - Core processing pipeline works with any registered document type
How are New OCR Engines Added?
New OCR engines are added through:
1. Implement OCREngine Interface - Create a class that implements the standard OCR engine contract
2. Register Engine - Add the engine to the OCR engine registry with:
- Engine identifier and display name
- Supported document types and languages
- Performance characteristics (latency, cost, accuracy profiles)
- Resource requirements (CPU/GPU, memory)
- Capabilities (handwriting, multi-language, layout understanding)
- Configuration parameters (model versions, tuning parameters)
3. Define Engine-Specific Preprocessing - Create preprocessing profiles optimized for the engine
4. Configure Routing Rules - Add routing logic to the engine selector based on document attributes
5. No Core Pipeline Changes - The orchestration layer works with any registered engine
How is Vendor Independence Achieved?
Vendor independence is achieved through:
- OCREngine Abstraction - All vendors implement the same interface
- Adapter Pattern - Vendor-specific SDKs wrapped in platform adapters
- Configuration-Driven Selection - Engine choice based on document attributes and policies
- Feature Parity Requirements - All engines must support core capabilities (text extraction, bounding boxes, confidence)
- Fallback Mechanisms - Automatic fallback to alternative engines on failure
- Cost-Aware Routing - Ability to prefer lower-cost options when accuracy is sufficient
- Response Normalization - Standardized output format regardless of underlying engine
How is AI Vendor Lock-in Avoided?
AI vendor lock-in is avoided through:
- Multi-Model Support - Simultaneous support for multiple AI/ML providers
- Abstract AI Service Layer - Common interface for all AI providers (Anthropic, OpenAI, Azure, Google)
- Model Versioning - Ability to specify and upgrade model versions independently
- Cost Optimization - Routing to most cost-effective provider meeting accuracy requirements
- Performance Benchmarking - Continuous evaluation of provider performance
- Data Portability - Standardized input/output formats enable easy migration
- Prompt Abstraction - Prompts engineered to work across similar model families
- Fallback to Open Source - Ability to fall back to self-hosted models (Tesseract, Donut, TrOCR)
- No Proprietary Data Formats - Use of standard JSON/image formats throughout
How Does the Complete Document Lifecycle Work?
The document lifecycle follows these stages:
 1. Ingestion - Document image received via API/upload, validated for format/size, virus scanned
 2. Pre-flight Analysis - Image quality assessment, script detection, layout estimation, orientation correction
 3. Classification - Document type identification using text/visual features with confidence scoring
 4. Registry Lookup - Retrieve document type configuration (prompts, schemas, rules, UI mapping)
 5. Preprocessing - Apply document-type-specific image enhancements (deskew, CLAHE, denoise, etc.)
 6. Prompt Generation - Create type-optimized prompt with anti-injection hardening
 7. OCR Execution - Execute selected OCR engine(s) with generated prompt
 8. Post-processing - Apply language model corrections, confidence calibration, and enrichment
 9. Validation - Apply multi-stage validation (structural, schema, business, semantic)
10. Response Building - Construct standardized OCR result with metadata, confidence, and validation results
11. Caching - Store result in cache for potential reuse
12. Presentation - Route to appropriate UI component based on document type and complexity
13. Review - Optional human review and correction with field-level guidance
14. Approval - Optional approval workflow for high-value or regulated documents
15. Export - Generate output in requested format(s) and deliver to downstream systems
16. Archiving - Store original image and OCR result per retention policy
17. Feedback - Capture user corrections for continuous learning and model improvement
18. Metrics - Record processing metrics, latency, cost, and accuracy for observability
How are Documents Processed?
Documents are processed through a configurable pipeline:
Sequential Processing Path:
Ingestion → Pre-flight Analysis → Classification → Registry Lookup → Preprocessing → 
Prompt Generation → OCR Execution → Post-processing → Validation → Response Building → 
Caching → Presentation
Parallel Processing Opportunities:
- Pre-flight analysis and initial lightweight classification can run in parallel
- Multiple OCR engines can be run simultaneously for consensus or fallback
- Validation stages can be pipelined for efficiency
- Post-processing steps (language modeling, enrichment) can be parallelized
Conditional Processing:
- High-confidence classifications may skip visual validation
- Simple documents may bypass expensive AI engines
- Cached results bypass processing entirely
- Low-confidence results trigger additional verification steps
How are Documents Validated?
Documents undergo multi-stage validation:
1. Structural Validation - Checks basic OCR output integrity (row/column consistency, empty cell ratio, alignment)
2. Schema Validation - Validates against document-type-specific JSON schema (required fields, types, patterns, enums)
3. Business Rule Validation - Applies document-type-specific rules (value ranges, cross-field checks, format validations, custom logic)
4. Semantic Validation - Applies AI/ML-enhanced checks (anomaly detection, trend analysis, fraud indicators, historical comparison)
5. Consistency Validation - Checks for internal consistency (mathematical relationships, logical constraints)
6. Compliance Validation - Ensures adherence to regulatory requirements (tax formats, audit trails, data retention)
Each validation stage produces field-specific errors/warnings with suggested corrections where applicable. Validation failures can be configured to block export or require human review.
How are Documents Rendered?
Documents are rendered through an adaptive presentation layer:
Rendering Process:
1. Extract document type and complexity metrics from OCR result
2. Calculate data density (field count × row/column count)
3. Select appropriate layout mode based on density and document type:
- Card View (< 10 fields, no repeating sections) - Form-style layout
- Compact Table (< 50 cells) - Simple editable table
- Sectioned Table (50-200 cells) - Collapsible sections with summary rows
- Paginated Table (> 200 cells) - Virtual scrolling with header statistics
- Tabbed View (Complex documents) - Organized sections in tabs
- Two-Panel View (Specific types like delivery notes) - Split layout for header/items
- Key-Value View (Handwritten forms) - Dynamic field listing
- Message List View (Transcripts, chats) - Chronological message display
Rendering Features:
- Field-level confidence visualization (color-coded badges, tooltips)
- Structural awareness (headers, line items, totals, tax sections)
- Support for repeating sections (line items, tax details)
- Inline correction with instant re-validation
- Smart navigation (jump to next uncertain field, batch similar field types)
- Change tracking with audit trail and undo/redo
- Export readiness indicators and preview
- Accessibility compliance (WCAG 2.1 AA)
- Responsive design for tablet/desktop use
How are Documents Exported?
Documents are exported through a flexible export engine:
Export Formats:
- Excel (.xlsx) - With formatting, data validation, and multiple sheets
- PDF - Searchable text with original image overlay
- JSON - Full structured OCR result with all metadata
- XML - Customizable schema for system integration
- CSV - Simple tabular data for basic systems
- EDI/X12 - Standard formats for supply chain integration
Export Features:
- Configurable column mapping and formatting per document type
- Support for multiple sheets/workbooks (summary + details)
- Embedded original images in PDF exports
- Data validation rules in Excel exports (dropdowns, constraints)
- Configurable headers, footers, and metadata inclusion
- Streaming export for large documents to prevent memory issues
- Integration hooks for direct database writes or API calls
- Audit trail inclusion in exports for compliance
- Encryption and secure transfer options for sensitive data
How are Documents Archived?
Documents are archived according to configurable retention policies:
Archiving Process:
 1. Original document image stored with SHA-256 hash for integrity verification
 2. Complete OCR result (including all metadata and processing history) stored
 3. Processing metrics, latency, and cost data retained for analytics
 4. User interaction history (reviews, corrections, approvals) preserved
 5. All data encrypted at rest using AES-256-GCM
 6. Storage tiering based on access frequency (hot/warm/cold)
 7. Automated cleanup based on retention policies (tax documents: 7 years, operational: 2 years, etc.)
 8. Legal hold capability to preserve documents during investigations
 9. Audit logging of all access and modification events
10. Disaster recovery and backup procedures for archived data
Archiving Policies:
- Configurable retention periods per document type and jurisdiction
- Automatic encryption and compression of archived data
- Geo-replication for disaster recovery
- Access controls aligned with data sensitivity and user roles
- Export capabilities for legal discovery and compliance requests
- Metadata indexing for efficient search and retrieval
- Storage cost optimization through lifecycle management
- Integration with enterprise archiving and records management systems
Now I'll create Document 2: OCR Engineering
OCR ENGINEERING MASTER PLAN
Phase 0: Foundation & Observability
Purpose: Establish monitoring, logging, and foundational services to create a measurable, observable baseline for the transformation.
Objectives:
- Implement structured logging with distributed tracing capabilities
- Add comprehensive Prometheus metrics for latency, throughput, error rates, and resource utilization
- Create centralized configuration management system with feature flag infrastructure
- Establish baseline performance measurements for all critical paths
- Implement structured error handling and reporting mechanisms
Business Value:
- Provides visibility into system performance and health from day one
- Enables data-driven decision making for optimization efforts
- Reduces mean time to detection (MTTD) and mean time to resolution (MTTR) for issues
- Creates foundation for SLAs and performance guarantees
- Enables proactive capacity planning and resource optimization
Dependencies: None (foundational phase)
Files/Modules Affected:
- backend/logging.py - Structured logging with trace ID propagation
- backend/metrics.py - Prometheus metrics collection and exposition
- backend/config.py - Centralized configuration management with feature flags
- backend/middleware/ - Request/response middleware for metrics and logging
- Dockerfiles - Enhanced for metrics exposition and health checks
- ci/cd/pipelines.yaml - Updated for metric collection and reporting
- monitoring/ - Dashboards and alerting rules configuration
- backend/health.py - Comprehensive health check endpoints
Engineering Risks:
- Low: Over-engineering logging/metrics - Mitigation: Start with essential metrics, iterate based on observed needs
- Low: Performance overhead from instrumentation - Mitigation: Use efficient sampling, async processing where possible
- Low: Configuration complexity - Mitigation: Hierarchical configuration with sensible defaults
- Low: Tooling compatibility issues - Mitigation: Standardize on open-source tools (Prometheus, Grafana, Jaeger/OTel)
Testing Strategy:
- Unit tests for all new logging/metrics functionality
- Integration tests verifying metric collection and exposition
- Load testing to measure instrumentation tests confirming acceptable performance overhead (<5%)
- Security scans to ensure no information leakage in logs/metrics
- Chaos engineering tests to validate observability during failures
Rollback Strategy:
- N/A: Additive changes only - Logging/metrics/configuration additions can remain even if other phases are rolled back
- Instant Rollback: Feature flags can disable new logging endpoints if needed
- Data Preservation: No destructive changes to existing data structures
Success Criteria:
- All services emit structured logs with trace IDs
- Key metrics (request latency, error rate, throughput, resource utilization) visible in Grafana dashboards
- Configuration system supports hierarchical overrides and feature flags
- Baseline performance measurements established for all critical paths
- Health check endpoints return accurate service status
Acceptance Criteria:
- Logging follows structured format (JSON) with required fields (timestamp, level, message, trace_id, service_name)
- Metrics endpoint exposes at least: ocr_request_duration_seconds, ocr_requests_total, ocr_errors_total, ocr_active_requests
- Configuration system allows environment-specific overrides without code changes
- Feature flag infrastructure enables/disables functionality without redeployment
- Baseline measurements captured for: end-to-end latency, classification accuracy, OCR success rate, cache hit ratio
Definition of Done:
- Structured logging implemented across all services
- Prometheus metrics endpoint exposed and scraping successfully
- Centralized configuration management in place
- Feature flag system operational with web UI for toggling
- Baseline performance dashboard created and populated
- All new code has >80% unit test coverage
- Security review completed for logging/metrics endpoints
- Documentation updated for new logging/metrics/configuration systems
- Knowledge transfer session conducted with platform team
Phase 1: Classification Integration
Purpose: Fix the critical classifier bypass issue by integrating document classification early in the pipeline to enable type-specific processing.
Objectives:
- Integrate DocumentClassifier into OCR pipeline before engine selection
- Modify classifier to return confidence scores with predictions
- Implement fallback logic for low-confidence classifications
- Register all existing document types in the new document registry
- Ensure backward compatibility with existing processing flows
Business Value:
- Unlocks all existing type-specific UI components (InvoiceReviewView, DeliveryNoteReviewView, etc.)
- Immediately improves user experience by showing appropriate interfaces
- Reduces processing costs by enabling early routing to appropriate engines
- Lays foundation for all future type-specific enhancements
- Delivers immediate value with relatively low implementation risk
Dependencies: Phase 0 (Foundation & Observability)
Files/Modules Affected:
- backend/services/classifier.py - Enhanced to return confidence scores
- backend/services/classification_pipeline.py (NEW) - Orchestrates multi-stage classification
- backend/services/document_registry.py (NEW) - Central document type registry
- backend/routers/ocr/_common.py - Modify _run_table_preview_pipeline to call classifier
- backend/services/ocr_document_pipeline.py - Modify build_structured_ocr_result to use classification results
- backend/models/document_type.py (NEW) - Document type data models
- backend/api/v1/endpoints/classify.py (NEW) - Classification API endpoint
- frontend/src/lib/document-types.ts (NEW) - Frontend document type definitions
Engineering Risks:
- Medium: Classification accuracy degradation - Mitigation: Confidence thresholding, fallback to visual classification, continuous learning
- Medium: Pipeline disruption risk - Mitigation: Feature flagged rollout, parallel run with legacy system
- Low: Increased latency from additional processing - Mitigation: Optimize classifier, early exits for high confidence
- Low: Data model changes - Mitigation: Backward compatible schema evolution, migration scripts
Testing Strategy:
- Unit tests for classifier confidence scoring and calibration
- Integration tests verifying correct UI routing for all document types
- Regression tests ensuring existing functionality remains intact
- Performance tests measuring classification latency impact
- A/B tests comparing legacy vs new pipeline accuracy and speed
- Edge case testing for unknown/ambiguous document types
- Security testing for classification API endpoint
Rollback Strategy:
- Feature Flag: OCR_USE_CLASSIFIER_PIPELINE (default: false → true)
- Instant Rollback: If issues arise, set flag to false to bypass new pipeline
- Parallel Run Capability: Ability to route percentage of traffic to new vs legacy pipeline for comparison
- Data Preservation: No schema changes requiring migration
Success Criteria:
- ≥ 95% classification accuracy on validated test set
- All existing document types route to correct UI components in frontend
- No regression in end-to-end processing time or error rate
- Classification confidence scores correlate with actual accuracy
- Fallback logic properly handles low-confidence cases
Acceptance Criteria:
- Classifier returns prediction with confidence score (0.0-1.0)
- System routes to type-specific UI when classification confidence ≥ threshold
- Low-confidence classifications trigger appropriate fallback mechanisms
- All legacy document types (GST invoice, delivery note, weighbridge, etc.) correctly identified
- Unknown document types routed to generic processing with manual review flag
- Classification results cached appropriately to avoid redundant processing
- End-to-end latency increase < 10% for successfully classified documents
Definition of Done:
- Classification pipeline implemented with confidence scoring
- Document registry populated with all existing document types
- OCR pipeline modified to call classification before engine selection
- Frontend routing updated to use classification results
- Feature flag OCR_USE_CLASSIFIER_PIPELINE implemented
- Unit tests for classification pipeline (>90% coverage)
- Integration tests verifying correct document routing
- Regression tests confirming no legacy functionality broken
- Performance benchmark showing <10% latency impact
- Security review completed for classification endpoints
- Documentation updated for classification API and registry
- Knowledge transfer session conducted with frontend and backend teams
Phase 2: Registry-Driven Prompts & Schema
Purpose: Enable type-specific OCR processing by moving prompts and JSON schemas to the document registry, implementing prompt rendering engine with versioning, and adding schema validation with anti-injection hardening.
Objectives:
- Move prompts and JSON schemas from hardcoded strings to document registry entries
- Implement prompt rendering engine with variable substitution, version control, and A/B testing support
- Add schema validation layer to enforce structured outputs from OCR engines
- Implement multi-layer anti-injection hardening (input sanitization, system prompt hardening, output validation)
- Establish A/B testing framework for prompt experimentation and optimization
Business Value:
- Enables type-specific OCR processing that improves extraction accuracy
- Eliminates hardcoded prompts, enabling easy addition of new document types
- Provides structured output validation that catches hallucinations and format errors
- Implements defense-in-depth against prompt injection attacks
- Allows data-driven prompt optimization through A/B testing
- Reduces prompt engineering effort through template reuse and versioning
Dependencies: Phase 1 (Classification Integration)
Files/Modules Affected:
- backend/services/document_registry.py - Extended to store prompts and schemas
- backend/services/prompt_service.py (NEW) - Prompt rendering, versioning, and A/B testing
- backend/services/validation_service.py (NEW) - Schema validation and anti-injection layers
- backend/routers/ocr/_common.py - Modify _call_table_excel_anthropic to use registry-driven prompts
- backend/services/ocr_document_pipeline.py - Update validation to use schema validation
- backend/models/prompt_template.py (NEW) - Prompt template data model
- backend/models/validation_rule.py (NEW) - Validation rule data model
- backend/services/experiment_framework.py (NEW) - A/B testing framework for prompts
- frontend/src/lib/prompt-templates.ts (NEW) - Frontend prompt definitions
Engineering Risks:
- Medium: Prompt rendering errors causing OCR failures - Mitigation: Comprehensive template testing, fallback to hardcoded prompts
- Medium: Schema validation rejecting valid outputs - Mitigation: Gradual rollout, warning-only mode initially
- Low: Performance overhead from prompt processing - Mitigation: Template caching, efficient variable substitution
- Low: A/B testing complexity - Mitigation: Simple traffic splitting, clear success metrics
Testing Strategy:
- Unit tests for prompt rendering with various variable substitutions
- Integration tests verifying correct prompt generation for all document types
- Schema validation tests covering valid/invalid outputs
- Anti-injection penetration tests (OWASP-inspired prompt injection attempts)
- A/B testing framework validation with traffic splitting and metrics collection
- Performance tests measuring prompt generation overhead
- Security tests for prompt service endpoints
- Backward compatibility tests with legacy hardcoded prompts
Rollback Strategy:
- Feature Flag: OCR_USE_REGISTRY_PROMPTS (default: false → true)
- Instant Rollback: If issues, set flag to false to use hardcoded prompts
- Selective Rollback: Per-document-type flags for granular control
- Fallback Mechanism: Automatic fallback to hardcoded prompts on rendering/validation errors
Success Criteria:
- 100% of document types use registry-driven prompts
- Schema validation passes for ≥ 99% of extractions
- No successful prompt injection attempts in security testing
- A/B testing framework functional with measurable impact on accuracy
- Fallback mechanisms for the of the hard-coded prompts
Acceptance Criteria:
- Prompts correctly rendered with all required variables substituted
- Schema validation rejects structurally invalid OCR outputs
- Anti-injection layers block common prompt injection techniques
- A/B testing framework properly splits traffic and measures conversion metrics
- Prompt versioning allows rollback to previous versions
- Experiment tracking captures metrics for each prompt variant
- Legacy hardcoded prompts still functional when feature flag disabled
Definition of Done:
- Prompt service implemented with rendering, versioning, and A/B testing capabilities
- Document registry extended to store prompts and JSON schemas
- Validation service implemented with schema validation and anti-injection layers
- OCR pipeline modified to use registry-driven prompts and validation
- Feature flag OCR_USE_REGISTRY_PROMPTS implemented
- Unit tests for prompt service (>90% coverage)
- Integration tests verifying correct prompt usage per document type
- Security testing confirming resistance to prompt injection
- A/B testing framework validated with traffic splitting
- Performance bench showing <5% overhead from prompt processing
- Documentation updated for prompt service, registry, and validation
- Knowledge transfer session conducted with backend and frontend teams
Phase 3: Pluggable OCR Engine Layer
Purpose: Implement engine abstraction and routing to support multiple OCR technologies with intelligent selection based on document attributes and policies.
Objectives:
- Define OCREngine interface as standard contract for all OCR implementations
- Integrate Tesseract (baseline), Donut, and Azure Read engines as initial implementations
- Implement intelligent routing based on document type, quality analysis, and policies
- Add cost tracking and circuit breaker pattern per engine for resilience
- Establish engine performance benchmarking and monitoring capabilities
Business Value:
- Enables selection of optimal OCR engine per document type (cost, accuracy, speed)
- Provides resilience through automatic fallback and circuit breaking
- Lays foundation for future engine additions without pipeline changes
- Enables cost optimization through routing to most efficient adequate engine
- Provides performance monitoring and bottleneck identification
- Reduces vendor lock-in through abstraction layer
Dependencies: Phase 1-2 (Classification Integration, Registry-Driven Prompts & Schema)
Files/Modules Affected:
- backend/services/ocr_engine.py (NEW) - OCREngine interface definition
- backend/services/ocr_engine_registry.py (NEW) - Engine registration and lookup
- backend/services/engine_router.py (NEW) - Intelligent engine selection logic
- backend/services/tesseract_engine.py (NEW) - Tesseract OCR implementation
- backend/services/donut_engine.py (NEW) - Donut vision model implementation
- backend/services/azure_read_engine.py (NEW) - Azure Computer Vision Read implementation
- backend/services/cost_tracker.py (NEW) - Per-engine cost monitoring
- backend/services/circuit_breaker.py (NEW) - Resilience pattern implementation
- backend/services/benchmark_suite.py (NEW) - Engine performance benchmarking
- backend/routers/ocr/_common.py - Replace direct engine calls with orchestrated selection
- backend/services/document_registry.py - Add engine preferences to document types
- backend/services/preprocessing_service.py - Extend for engine-specific preprocessing profiles
Engineering Risks:
- High: Architectural complexity from abstraction layer - Mitigation: Start with 1-2 engines, iterate, maintain clear interfaces
- High: Integration challenges with diverse OCR technologies - Mitigation: Adapter pattern, thorough testing per engine
- Medium: Performance overhead from routing and abstraction - Mitigation: Optimize critical paths, benchmark regularly
- Medium: Engine-specific quirks and error handling - Mitigation: Comprehensive adapter testing, fallback mechanisms
- Low: Cost tracking accuracy - Mitigation: Regular auditing against actual provider bills
Testing Strategy:
- Unit tests for OCREngine interface compliance per implementation
- Integration tests verifying correct engine selection based on document attributes
- Performance benchmarking comparing engine latency, throughput, and resource usage
- Circuit breaker failure simulation and recovery testing
- Cost tracking accuracy validation against actual usage
- Engine-specific feature tests (handwriting, multi-language, layout understanding)
- Load testing to verify horizontal scaling capabilities
- Security testing for engine adapter endpoints
- Chaos engineering tests for engine failure scenarios
Rollback Strategy:
- Feature Flag: OCR_USE_PLUGGABLE_ENGINES (default: false → true)
- Per-Engine Flags: Individual flags for each engine (e.g., OCR_USE_TESSERACT, OCR_USE_DONUT)
- Instant Rollback: Disable flags to revert to legacy engine usage
- Gradual Rollout: Route percentage of traffic to new engine orchestration
- Fallback Chains: Automatic fallback to legacy engines on failure
Success Criteria:
- All three engines (Tesseract, Donut, Azure) successfully integrated
- Routing correctly selects engine based on document attributes and policies
- Cost tracking accurate within 10% of actual provider charges
- Circuit breakers engage appropriately on simulated engine failures
- System maintains ≥ 95% of legacy OCR accuracy while enabling engine selection
Acceptance Criteria:
- OCREngine interface properly implemented by all engine adapters
- Engine selector chooses Tesseract for simple high-quality prints
- Engine selector chooses Donut/Azure for complex forms, handwriting, low-quality scans
- Cost tracking records actual usage costs per engine
- Circuit breakers open after threshold of failures, redirect traffic to alternatives
- Engine benchmarking suite provides comparable performance metrics
- Legacy engine still functional when new orchestration disabled
- No regression in end-to-end accuracy for documents processed by legacy engine
Definition of Done:
- OCREngine interface defined and implemented by Tesseract, Donut, Azure adapters
- Engine registry and router implemented with intelligent selection logic
- Cost tracking and circuit breaker patterns implemented per engine
- OCR pipeline modified to use engine orchestration layer
- Feature flags for orchestration and individual engines implemented
- Unit tests for all engine adapters (>80% coverage each)
- Integration tests verifying correct engine selection and routing
- Performance benchmarking suite established and baseline measurements taken
- Circuit breaker failure/recovery tested successfully
- Cost tracking validated against actual usage (within 10%)
- Security review completed for all engine adapter endpoints
- Documentation updated for OCREngine interface, registry, and routing
- Knowledge transfer session conducted with backend, ML, and DevOps teams
Phase 4: Advanced Preprocessing & Confidence Calibration
Purpose: Improve OCR accuracy and confidence reliability through modular preprocessing pipeline, engine-specific preprocessing profiles, per-token confidence calibration, and language model rescoring.
Objectives:
- Implement modular preprocessing pipeline with configurable steps (deskew, CLAHE, denoise, background normalization, binarization)
- Create engine-specific preprocessing profiles stored in document registry
- Implement per-token confidence calibration using Platt scaling or isotonic regression per engine
- Add language model rescoring stage for low-confidence tokens to improve accuracy
- Establish confidence quality metrics and calibration validation procedures
Business Value:
- Improves OCR accuracy through optimized preprocessing per document type and engine
- Ensures confidence scores reflect true probability of correctness (well-calibrated)
- Reduces false confidence in OCR outputs through calibration
- Improves accuracy on challenging documents through language model rescoring
- Enables data-driven preprocessing optimization per engine/document type combination
- Provides foundation for confidence-based routing and review workflows
Dependencies: Phase 3 (Pluggable OCR Engine Layer)
Files/Modules Affected:
- backend/services/ocr_preprocessing.py (NEW) - Modular preprocessing pipeline with configurable steps
- backend/services/confidence_calibration.py (NEW) - Per-token confidence calibration (Platt scaling/isotonic regression)
- backend/services/lm_rescorer.py (NEW) - Language model rescoring for low-confidence tokens
- backend/services/document_registry.py - Extended to store preprocessing profiles per engine/document type
- backend/services/ocr_document_pipeline.py - Integrate preprocessing, calibration, and rescoring stages
- backend/services/preprocessing_profile.py (NEW) - Preprocessing profile data model
- backend/services/calibration_data.py (NEW) - Management of calibration data collection and updating
- backend/services/confidence_metrics.py (NEW) - Confidence quality metrics (Brier score, log loss, reliability diagrams)
- frontend/src/lib/confidence-metrics.ts (NEW) - Frontend confidence visualization definitions
Engineering Risks:
- Medium: Over-processing degrading OCR quality - Mitigation: Per-engine/document-type optimization, validation-based tuning
- Medium: Calibration drift over time - Mitigation: Continuous calibration updating with fresh data
- Medium: Language model rescoring latency - Mitigation: Token batching, efficient model serving, confidence-based triggering
- Low: Increased complexity in preprocessing pipeline - Mitigation: Modular design, clear step interfaces, caching
- Low: Data privacy concerns with calibration data - Mitigation: Anonymization, aggregation, retention policies
Testing Strategy:
- Unit tests for each preprocessing step with visual quality validation
- Integration tests verifying correct preprocessing profile application per document type/engine
- Confidence calibration tests measuring Brier score/log loss improvement
- Language model rescoring impact tests on WER/CER for low-confidence tokens
- End-to-end accuracy benchmarks comparing baseline vs enhanced pipeline
- Performance tests measuring preprocessing and rescoring overhead
- Security tests for preprocessing service endpoints
- Data drift detection tests for calibration validity over time
Rollback Strategy:
- Feature Flags: 
- OCR_USE_ADVANCED_PREPROCESS (default: false → true)
- OCR_USE_CONFIDENCE_CALIBRATION (default: false → true)
- OCR_USE_LM_RESCORER (default: false → true)
- Instant Rollback: Disable individual flags to revert to legacy processing stages
- Selective Application: Per-engine/document-type feature flags for granular control
- Data Preservation: Calibration data can be archived but not required for rollback
Success Criteria:
- ≥ 15% relative WER reduction on validated test set
- Confidence scores well-calibrated (reliability diagram close to diagonal, Brier score improved)
- Preprocessing profiles correctly applied per document type and engine
- Language model rescoring provides measurable improvement on low-confidence tokens (<0.6 confidence)
- System maintains or improves processing latency despite additional stages
Acceptance Criteria:
- Preprocessing pipeline applies correct sequence of steps per profile
- Confidence calibration reduces over/under-confidence in scores
- Language model rescoring improves accuracy on low-confidence tokens without degrading high-confidence ones
- Preprocessing profiles stored in registry and retrieved correctly per document type/engine
- Calibration data updated regularly with field-collected samples
- Confidence quality metrics show improvement over baseline
- End-to-end latency increase < 15% for documents requiring full preprocessing pipeline
Definition of Done:
- Modular preprocessing pipeline implemented with configurable steps
- Preprocessing profiles stored in registry and applied per document type/engine
- Confidence calibration implemented per engine with updating mechanism
- Language model rescoring integrated for low-confidence tokens
- Confidence quality metrics implemented and tracked
- Feature flags for each stage implemented
- Unit tests for preprocessing, calibration, and rescoring (>80% coverage each)
- Integration tests verifying correct application per document type/engine
- Performance benchmark showing <15% latency overhead
- Accuracy bench showing ≥15% WER reduction on test set
- Calibration data pipeline validated with sample collection and updating
- Security review completed for preprocessing service endpoints
- Documentation updated for preprocessing, calibration, and rescoring systems
- Knowledge transfer session conducted with backend, ML, and DevOps teams
Phase 5: Validation Pipeline & Response Schema
Purpose: Implement comprehensive validation pipeline and enriched OCR response schema to provide actionable feedback and structured output.
Objectives:
- Build multi-stage validation pipeline (structural, schema, business, semantic) with configurable rules
- Define and implement enriched OCR response schema with metadata, confidence scores, validation results, and structural elements
- Integrate validation results into OCR response for client consumption
- Implement field-level validation feedback mechanisms in frontend
- Establish validation quality metrics and continuous improvement procedures
Business Value:
- Provides actionable, field-specific validation feedback to users
- Enables early detection and correction of data errors
- Improves data quality flowing to downstream systems
- Supports compliance requirements through comprehensive validation and audit trails
- Provides foundation for confidence-based review workflows
- Enables structured data exchange with external systems
- Reduces manual data cleaning efforts in downstream processes
Dependencies: Phase 4 (Advanced Preprocessing & Confidence Calibration)
Files/Modules Affected:
- backend/services/validation_pipeline.py (NEW) - Multi-stage validation pipeline (structural, schema, business, semantic)
- backend/models/ocr_result.py (NEW) - Pydantic model for enriched OCR response
- backend/services/ocr_document_pipeline.py - Update response building to use enriched schema
- backend/services/validation_rule.py (EXTENDED) - Enhanced validation rule model with types and enforcement
- backend/services/validation_metrics.py (NEW) - Validation quality metrics and effectiveness tracking
- frontend/src/lib/ocr-types.ts (EXTENDED) - Updated OCR result type definitions
- frontend/src/lib/validation-display.tsx (NEW) - Component for displaying field-level validation feedback
- frontend/src/lib/confidence-display.tsx (NEW) - Component for visualizing field-level confidence scores
- frontend/src/lib/review-workflow.ts (EXTENDED) - Enhanced review workflow with validation feedback integration
- backend/services/document_registry.py - Extended to store validation rules per document type
- backend/services/error_formatter.py (NEW) - Standardized error/warning formatting for clients
Engineering Risks:
- Medium: Validation pipeline becoming bottleneck - Mitigation: Parallelizable stages, early exits, caching of rule evaluations
- Medium: Schema validation rejecting valid outputs due to over-constraining - Mitigation: Gradual rollout, warning-only mode, continuous tuning
- Medium: Increased response size affecting clients - Mitigation: Optional fields, compression, client-side filtering
- Low: Validation rule complexity and maintenance - Mitigation: Registry-driven, versioned rules, automated testing
- Low: Frontend complexity increase - Mitigation: Modular components, progressive disclosure, user testing
Testing Strategy:
- Unit tests for each validation stage (structural, schema, business, semantic)
- Integration tests verifying correct validation rule application per document type
- Validation effectiveness tests measuring error detection and false positive rates
- End-to-end tests verifying validation results in OCR response
- Frontend integration tests for validation display components
- Performance tests measuring validation pipeline overhead
- Security tests for validation service endpoints
- Chaos engineering tests for validation failure scenarios
- Backward compatibility tests with legacy flat response format
Rollback Strategy:
- Feature Flag: OCR_USE_ENRICHED_RESPONSE (default: false → true)
- Gradual Rollout: 
- Phase 1: Internal services use enriched schema, legacy clients receive flattened version
- Phase 2: Gradually route client traffic to enriched response version
- Phase 3: Full cutover to enriched response with legacy client adapter if needed
- Instant Rollback: Disable flag to revert to legacy response format for all clients
- Backward Compatibility: Legacy response flattening service maintains compatibility
- Data Preservation: Enriched schema contains all legacy data plus additional fields
Success Criteria:
- Validation pipeline catches ≥ 90% of known error types in test set
- Enriched response schema adopted by all internal consumers
- Field-level validation feedback visible and actionable in verification UI
- No schema-breaking changes to existing API consumers (backward compatibility maintained)
- Validation quality metrics show improvement over baseline
Acceptance Criteria:
- Multi-stage validation pipeline properly processes documents through all stages
- Enriched OCR result contains all required metadata, confidence scores, validation results, and structural elements
- Field-level validation errors/warnings displayed correctly in frontend with actionable guidance
- Legacy clients receive compatible flattened response when needed
- Validation quality metrics (precision, recall, F1) show improvement over baseline
- Validation pipeline introduces < 10% latency overhead
- Validation rules stored in registry and correctly applied per document type
- Validation metrics pipeline tracks effectiveness and provides improvement suggestions
Definition of Done:
- Multi-stage validation pipeline implemented with structural, schema, business, and semantic stages
- Enriched OCR result Pydantic model defined and implemented
- OCR pipeline updated to build and return enriched response format
- Validation quality metrics implemented and tracked
- Field-level validation feedback components implemented in frontend
- Review workflow enhanced to integrate validation feedback
- Feature flag OCR_USE_ENRICHED_RESPONSE implemented
- Unit tests for validation pipeline (>80% coverage per stage)
- Integration tests verifying correct validation application per document type
- End-to-end tests confirming validation results in OCR response
- Frontend integration tests for validation display components
- Performance benchmark showing <10% latency overhead
- Backward compatibility verified for legacy API consumers
- Security review completed for validation service endpoints
- Documentation updated for validation pipeline, enriched response, and frontend components
- Knowledge transfer session conducted with backend, frontend, and DevOps teams
Phase 6: Frontend Adaptive Layout & Review UX
Purpose: Implement intelligent, adaptive user interface that matches document complexity and provides intelligent review workflows.
Objectives:
- Implement data-density adaptive layout (compact/summary/paginated/card) based on document complexity
- Add field-level confidence visualization and hints for intelligent review guidance
- Enhance review workflow with smart navigation, correction suggestions, and change tracking
- Implement export readiness indicators and multiple format options with preview
- Establish accessibility compliance (WCAG 2.1 AA) and responsive design for tablet/desktop use
Business Value:
- Provides optimal user interface for each document complexity level
- Reduces cognitive load by showing complexity only when needed
- Improves review efficiency through confidence-guided navigation and suggestions
- Decreases time to correct errors through intelligent field highlighting
- Increases user satisfaction through adaptive, intuitive interfaces
- Supports accessibility requirements for diverse user base
- Enables mobile/tablet use in factory and warehouse environments
- Reduces training requirements through intuitive, context-aware interfaces
Dependencies: Phase 5 (Validation Pipeline & Response Schema)
Files/Modules Affected:
- frontend/src/lib/layout-strategy.ts (NEW) - Adaptive layout logic based on data density and document type
- frontend/src/lib/confidence-display.tsx (NEW) - Component for visualizing field-level confidence scores
- frontend/src/views/adaptive-table-view.tsx (NEW) - Handles compact/summary/paginated layout modes
- frontend/src/views/card-form-view.tsx (NEW) - Card-style view for low-density forms
- frontend/src/views/sectioned-view.tsx (NEW) - Sectioned view for documents with logical groupings
- frontend/src/views/paginated-table-view.tsx (NEW) - Paginated view with virtual scrolling for large documents
- frontend/src/components/confidence-badge.tsx (NEW) - Component for displaying field-level confidence
- frontend/src/lib/review-workflow.ts (EXTENDED) - Enhanced review workflow with smart navigation and suggestions
- frontend/src/lib/export-manager.ts (NEW) - Component for managing export options and preview
- frontend/src/lib/accessibility-utils.ts (NEW) - Utilities for WCAG 2.1 AA compliance
- frontend/src/lib/responsive-design.ts (NEW) - Responsive design breakpoints and adaptations
- frontend/src/lib/document-type-resolver.ts (EXTENDED) - Enhanced to determine layout mode from OCR result
- frontend/src/styles/ (EXTENDED) - Updated CSS for new components and responsive design
Engineering Risks:
- Medium: Frontend bundle size increase - Mitigation: Code splitting, lazy loading, tree shaking
- Medium: Performance degradation with large documents - Mitigation: Virtual scrolling, skeleton loaders, incremental rendering
- Medium: Complexity in state management - Mitigation: Modular stores, clear separation of concerns
- Low: Accessibility compliance gaps - Mitigation: Automated testing, manual audits, user testing with assistive technologies
- Low: Responsive design breakpoints not optimal - Mitigation: Data-driven breakpoint selection, user testing
Testing Strategy:
- Unit tests for layout strategy logic with various document complexity scenarios
- Integration tests verifying correct layout mode selection per document type
- Component tests for all new UI components (confidence display, adaptive views, etc.)
- End-to-end tests verifying adaptive layout selection and rendering
- Performance tests with large documents (1000+ rows) measuring render time and memory usage
- Accessibility testing (axe-core, manual testing with screen readers)
- Responsive design testing across device breakpoints
- User acceptance testing with factory and warehouse users
- Security testing for XSS vulnerabilities in dynamic content rendering
- Chaos engineering tests for frontend resilience during backend failures
Rollback Strategy:
- Feature Flags (per layout mode):
- OCR_USE_CARD_VIEW (default: false → true)
- OCR_USE_COMPACT_TABLE (default: false → true)
- OCR_USE_SECTIONED_TABLE (default: false → true)
- OCR_USE_PAGINATED_TABLE (default: false → true)
- Gradual Rollout: 
- Route percentage of document types to new layout modes
- Monitor user satisfaction and task completion metrics
- Gradually increase adoption based on feedback
- Instant Rollback: Disable flags to revert to legacy generic table view
- Backward Compatibility: Legacy generic table view maintained as fallback option
- Data Preservation: No changes to data structures required for rollback
Success Criteria:
- All document types use appropriate layout mode based on complexity and type
- Field-level confidence visualization implemented and actionable
- Review workflow enhancements (smart navigation, suggestions, change tracking) functional
- Export options working with preview functionality
- Accessibility compliance achieved (WCAG 2.1 AA)
- Performance acceptable for 1000+ row documents (< 3s initial render, < 1s interaction latency)
Acceptance Criteria:
- Layout strategy correctly selects mode based on data density (rows×columns) and document type
- Card view used for low-density forms (< 10 fields, no repeating sections)
- Compact table used for simple documents (< 50 cells)
- Sectioned table used for medium complexity documents (50-200 cells)
- Paginated table used for large documents (> 200 cells) with virtual scrolling
- Field-level confidence visualized with color coding (green ≥0.85, yellow 0.60-0.85, red <0.60)
- Hover tooltips show exact confidence scores and field information
- Review workflow enables jump to next low-confidence field
- AI-powered correction suggestions displayed for uncertain fields
- Change tracking with audit trail and undo/redo functionality
- Export dialog shows preview and supports multiple formats (Excel, PDF, JSON, XML)
- All interactive elements keyboard accessible and screen reader friendly
- Responsive layout adapts to mobile/tablet breakpoints
- User satisfaction scores ≥ 4/5 in acceptance testing
- Task completion time reduced by ≥ 25% vs legacy interface for review tasks
Definition of Done:
- Adaptive layout strategy implemented and integrated
- All four layout modes (card, compact, sectioned, paginated) implemented
- Field-level confidence visualization components implemented
- Review workflow enhanced with smart navigation, suggestions, and change tracking
- Export manager implemented with preview and multiple format options
- Accessibility utilities implemented and verified
- Responsive design breakpoints and adaptations implemented
- Document type resolver enhanced to determine layout mode
- Feature flags for each layout mode implemented
- Unit tests for all new frontend components (>80% coverage each)
- Integration tests verifying correct layout selection per document type
- End-to-end tests confirming adaptive layout and rendering
- Performance tests showing acceptable performance with large documents
- Accessibility audit passes WCAG 2.1 AA standards
- User acceptance testing completed with factory/warehouse users
- Security review completed for new frontend components
- Documentation updated for all new frontend components and features
- Knowledge transfer session conducted with frontend, UX, and product teams
Phase 7: Scalability & Observability Enhancements
Purpose: Enable horizontal scaling and production readiness through specialized worker pools, message queuing, caching, autoscaling, and distributed tracing.
Objectives:
- Implement specialized worker pools (CPU-intensive and GPU-intensive) for different processing stages
- Add message queuing system for asynchronous processing and load leveling
- Implement Redis caching layer for OCR results to reduce redundant processing
- Add autoscaling policies based on queue depth, latency, and resource metrics
- Implement distributed tracing (OpenTelemetry/Jaeger) for end-to-end visibility
- Establish service-level objectives (SLOs) and service-level indicators (SLIs) for reliability
Business Value:
- Enables system to handle high volumes of documents (100+ per minute) with consistent performance
- Reduces processing costs through intelligent resource utilization and caching
- Improves system resilience through load leveling and failure isolation
- Provides end-to-end visibility for performance optimization and troubleshooting
- Enables proactive capacity planning through predictive autoscaling
- Supports compliance requirements through comprehensive audit trails and metrics
- Reduces mean time to recovery (MTTR) through detailed failure diagnostics
Dependencies: Phase 6 (Frontend Adaptive Layout & Review UX)
Files/Modules Affected:
- backend/services/worker-pools.py (NEW) - Specialized CPU and GPU worker pools
- backend/services/message-queue.py (NEW) - Message queuing system (RabbitMQ/RMQ) for async processing
- backend/services/redis-cache.py (NEW) - Redis-backed caching layer for OCR results
- backend/services/autoscaler.py (NEW) - Autoscaling policies based on metrics and queue depth
- backend/services/tracing.py (NEW) - Distributed tracing implementation (OpenTelemetry/Jaeger)
- backend/services/health-checks.py (EXTENDED) - Enhanced health checks for scaled services
- backend/services/load-balancer.py (NEW) - Load balancing across worker pool instances
- backend/services/metrics-aggregator.py (NEW) - Metrics collection and aggregation for scaled services
- backend/services/failure-detector.py (NEW) - Failure detection and automatic failover mechanisms
- backend/services/circuit-breaker.py (EXTENDED) - Enhanced circuit breakers for scaled services
- backend/services/deployment-manager.py (NEW) - Deployment coordination for scaled services
- docker-compose.yml (EXTENDED) - Updated for worker pools, message queue, Redis cache
- kubernetes/ (NEW) - Kubernetes manifests for production deployment
- backend/services/document_registry.py - Extended to cache registry lookups
- backend/services/ocr_engine.py - Extended to support worker pool execution
Engineering Risks:
- High: Increased system complexity from distribution - Mitigation: Start with single-instance deployment, gradually add distribution elements
- High: Message queue complexity and failure points - Mitigation: Well-tested queuing system, dead letter queues, monitoring
- Medium: Cache coherency and invalidation complexity - Mitigation: TTL-based caching, cache-aside pattern, invalidation events
- Medium: Autoscaling instability (oscillation, over/under-provisioning) - Mitigation: Conservative policies, hysteresis, cooldown periods
- Low: Distributed tracing overhead - Mitigation: Sampling, efficient propagation, aggregation
- Low: Network partitioning and split-brain scenarios - Mitigation: Consensus protocols, health checks, graceful degradation
Testing Strategy:
- Unit tests for all new scaling and observability components
- Integration tests verifying worker pool message passing and processing
- Load testing (100+ documents/minute) verifying horizontal scaling and performance
- Failover and recovery testing for worker pools, message queue, and cache
- Autoscaling trigger validation with artificial load spikes
- Distributed tracing validation showing end-to-end latency breakdown
- Cache hit ratio validation with repeated document types
- Network partitioning tests verifying graceful degradation
- Security tests for all new service endpoints
- Chaos engineering tests for various failure scenarios (network, worker failure, queue backup)
Rollback Strategy:
- Feature Flags (per scaling component):
- OCR_USE_WORKER_POOLS (default: false → true)
- OCR_USE_MESSAGE_QUEUE (default: false → true)
- OCR_USE_REDIS_CACHE (default: false → true)
- OCR_USE_AUTOSCALER (default: false → true)
- OCR_USE_TRACING (default: false → true)
- Instant Rollback: Disable flags to revert to monolithic, synchronous processing
- Gradual Rollout: 
- Deploy scaling elements alongside monolithic version
- Route percentage of traffic to scaled version
- Monitor performance, error rates, and resource utilization
- Gradually increase traffic to scaled version based on metrics
- Data Preservation: 
- Message queue can be drained and disabled
- Cache can be cleared and bypassed
- Worker pools can be scaled down to single instances
- No destructive data changes required
Success Criteria:
- System handles 100+ documents/minute with < 2s 95th percentile latency
- Cache hit ratio ≥ 25% for repeated document types
- Autoscaling responds to load changes within 30 seconds
- Distributed tracing shows end-to-end latency breakdown with < 10% overhead
- System maintains ≥ 99.5% availability during planned scaling events
- Recovery time from failure events < 5 minutes
Acceptance Criteria:
- Worker pools properly distribute CPU-intensive and GPU-intensive workloads
- Message queue enables asynchronous processing with guaranteed delivery
- Redis cache stores and retrieves OCR results with appropriate TTL
- Autoscaling policies trigger based on queue depth and latency metrics
- Distributed tracing propagates trace IDs through all service boundaries
- Load balancer distributes traffic evenly across worker pool instances
- Health checks reflect accurate status of scaled services
- Failure detection and automatic failover mechanisms functional
- Metrics aggregation provides system-wide view of performance and resource utilization
- Deployment coordination enables zero-downtime updates
- End-to-end latency ≤ 2s for 95th percentile of requests under load
- Cache hit ratio ≥ 25% for repeated document types processed within TTL window
- Autoscaling adjusts worker count within 30 seconds of sustained load change
- Distributed tracing shows < 10% overhead and captures end-to-end latency
- Recovery from simulated failures (worker, network, queue) completed within 5 minutes
- Security review completed for all new service endpoints
- Performance testing validates horizontal scaling capabilities
Definition of Done:
- Specialized worker pools (CPU/GPU) implemented and processing documents
- Message queuing system implemented for asynchronous processing
- Redis caching layer implemented for OCR results
- Autoscaling policies implemented based on queue depth and latency metrics
- Distributed tracing implemented with OpenTelemetry/Jaeger
- Enhanced health checks, load balancing, and failure detection implemented
- Feature flags for each scaling component implemented
- Unit tests for all new scaling and observability components (>80% coverage each)
- Integration tests verifying message passing, caching, and worker pool processing
- Load testing demonstrating horizontal scaling (100+ docs/minute)
- Failover and recovery testing validating system resilience
- Autoscaling trigger verification with artificial load scenarios
- Distributed tracing validation showing end-to-end latency propagation
- Cache hit ratio validation with repeated document types
- Security review completed for all new service endpoints
- Documentation updated for all scaling and observability components
- Knowledge transfer session conducted with backend, DevOps, and platform teams
- Deployment documentation updated for scaled production deployment
Phase 8: Security, Compliance & Cost Management
Purpose: Ensure enterprise security, compliance, and cost control through encryption, data retention, access controls, cost monitoring, and compliance features.
Objectives:
- Implement encryption for data at rest (AES-256-GCM) and in transit (TLS 1.3)
- Add data retention and deletion workflows with configurable policies per document type
- Implement fine-grained access controls (RBAC/ABAC) for data and operations
- Add real-time cost monitoring and budget alerts with predictive forecasting
- Implement GDPR/CCPA compliance features (data export, deletion, consent management)
- Establish audit trail and immutability guarantees for compliance requirements
Business Value:
- Protects sensitive factory and supplier data from unauthorized access and breaches
- Ensures compliance with data protection regulations (GDPR, CCPA, industry-specific)
- Controls and predicts operational costs to prevent budget overruns
- Provides granular access controls to support least privilege principles
- Enables data subject rights fulfillment (access, portability, deletion)
- Supports audit requirements with comprehensive, immutable logs
- Reduces risk of data breaches and associated financial/reputational damage
- Builds trust with customers, suppliers, and regulatory bodies
Dependencies: Phase 7 (Scalability & Observability Enhancements)
Files/Modules Affected:
- backend/services/encryption.py (NEW) - Encryption for data at rest and in transit
- backend/services/data-retention.py (NEW) - Data retention policies and automated deletion workflows
- backend/services/access-control.py (NEW) - Fine-grained RBAC/ABAC access control system
- backend/services/cost-monitor.py (NEW) - Real-time cost monitoring, budget alerts, forecasting
- backend/services/compliance.py (NEW) - GDPR/CCPA compliance features and reporting
- backend/services/audit-logger.py (NEW) - Comprehensive, immutable audit logging
- backend/services/key-manager.py (NEW) - Key management service for encryption keys
- backend/services/data-classifier.py (NEW) - Data classification for sensitivity-based handling
- backend/services/consent-manager.py (NEW) - Consent management for GDPR/CCPA compliance
- backend/services/secure-delete.py (NEW) - Secure deletion with verification
- backend/middleware/authentication.py (EXTENDED) - Enhanced authentication and authorization
- backend/middleware/authorization.py (EXTENDED) - Enhanced authorization policies and checks
- backend/services/document_registry.py - Extended to store security and compliance metadata per document type
- backend/services/ocr_engine.py - Extended to support secure credentials and encrypted communication
- backend/services/message-queue.py - Extended to support message encryption and authentication
- backend/services/redis-cache.py - Extended to support encrypted cache values
- docker-compose.yml (EXTENDED) - Updated for encryption, key management, and secure services
- kubernetes/ (EXTENDED) - Updated for security contexts, secrets, and network policies
Engineering Risks:
- Medium: Encryption key management complexity - Mitigation: Use established key management services (HashiCorp Vault, AWS KMS, Azure Key Vault)
- Medium: Performance overhead from encryption/decryption - Mitigation: Hardware acceleration, efficient algorithms, session reuse
- Medium: Access control complexity leading to unintended access blocking - Mitigation: Comprehensive testing, gradual rollout, break-glass procedures
- Medium: Cost monitoring accuracy and prediction reliability - Mitigation: Regular calibration, ensemble methods, confidence intervals
- Low: Compliance feature gaps - Mitigation: Regular compliance audits, user testing with legal/compliance teams
- Low: Secure deletion verification complexity - Mitigation: Cryptographic erasure, verified overwrite patterns
Testing Strategy:
- Unit tests for all new security, compliance, and cost management components
- Integration tests verifying encryption/decryption correctness and performance
- Penetration testing (external) for OWASP Top 10 and API-specific vulnerabilities
- Data retention workflow tests verifying correct deletion and verification
- Access control tests verifying correct authorization and denial of unauthorized access
- Cost monitoring accuracy tests against actual usage and forecasts
- GDPR/CCPA compliance tests for data export, deletion, and consent management
- Audit log tests verifying immutability and completeness
- Key management tests verifying key lifecycle and rotation
- Security scanning for dependency vulnerabilities (Snyk, Dependabot, etc.)
- Chaos engineering tests for security failure scenarios (key loss, certificate expiration)
Rollback Strategy:
- Feature Flags (per security/compliance component):
- OCR_USE_ENCRYPTION (default: false → true)
- OCR_USE_DATA_RETENTION (default: false → true)
- OCR_USE_ACCESS_CONTROL (default: false → true)
- OCR_USE_COST_MONITOR (default: false → true)
- OCR_USE_COMPLIANCE (default: false → true)
- Selective Rollback: 
- Encryption: Can decrypt and re-encrypt with legacy method if needed
- Data Retention: Policies can be disabled, deletion workflows halted
- Access Control: Can revert to legacy RBAC or disable enforcement
- Cost Monitor: Monitoring can be disabled, alerts silenced
- Compliance: Features can be turned off, falling back to minimal compliance
- Data Preservation:
- Encrypted data can be re-encrypted with legacy method if algorithm changes
- Retention policies changes affect future deletions only
- Access control changes affect future access decisions only
- Cost monitoring changes affect future alerts only
- Compliance feature changes affect future reporting only
Success Criteria:
- All data encrypted at rest (AES-256-GCM) and in transit (TLS 1.3)
- Data retention policies functioning correctly with automated deletion verification
- Access controls preventing unauthorized access to sensitive data and operations
- Cost monitoring accurate within 5% of actual provider charges
- GDPR/CCPA compliance features functional (data export, deletion, consent management)
- Audit logs complete, immutable, and tamper-evident
- System passes baseline compliance checklist for target regulations
Acceptance Criteria:
- Encryption service properly encrypts and decrypts data using AES-256-GCM
- All external service communications use TLS 1.3 with proper certificate validation
- Data retention policies trigger deletion of documents after configured periods
- Deleted data is cryptographically erased and verified unrecoverable
- Access controls grant least privilege access based on roles and attributes
- Unauthorized access attempts are properly logged and denied
- Cost monitoring alerts trigger within 5% of budget thresholds
- Forecasted costs align with actual usage within 10% margin of error
- GDPR data export requests fulfilled within legal timeframes
- GDPR deletion requests processed with verification of completion
- Consent management tracks and respects user preferences for data processing
- Audit logs capture all relevant events with integrity verification
- Key management service provides secure key generation, storage, rotation, and destruction
- Data classification correctly identifies sensitivity levels for handling rules
- Security review completed for all new service endpoints
- Penetration testing shows no critical or high severity vulnerabilities
- Dependency scanning shows no known vulnerable packages in use
Definition of Done:
- Encryption implemented for data at rest (AES-256-GCM) and in transit (TLS 1.3)
- Data retention and deletion workflows implemented with verification
- Fine-grained access control system (RBAC/ABAC) implemented
- Real-time cost monitoring and budget alerts implemented
- GDPR/CCPA compliance features (export, deletion, consent) implemented
- Comprehensive, immutable audit logging implemented
- Key management service implemented for encryption keys
- Data classification and consent management services implemented
- Secure deletion with verification implemented
- Feature flags for each security/compliance component implemented
- Unit tests for all new security/compliance/cost components (>80% coverage each)
- Integration tests verifying encryption/decryption, access control, and data retention
- Penetration testing completed with no critical/high findings
- Dependency scanning shows no known vulnerable packages
- Data retention workflow tests verify correct automated deletion
- Access control tests verify correct authorization and denial
- Cost monitoring accuracy validated against actual usage (<5% error)
- GDPR/CCPA compliance tests verify export, deletion, and consent functionality
- Audit log tests verify immutability and completeness
- Key management tests verify secure key lifecycle
- Security review completed for all new service endpoints
- Documentation updated for all security, compliance, and cost management components
- Knowledge transfer session conducted with backend, security, and compliance teams
- Deployment documentation updated for secure production deployment
Phase 9: Continuous Learning & Optimization
Purpose: Implement feedback loops for ongoing improvement through mislabelled sample collection, active learning, model retraining, A/B testing, and drift detection.
Objectives:
- Add mislabelled sample collection mechanism from user corrections and reviews
- Implement active learning for uncertain predictions to reduce annotation effort
- Create model retraining pipeline with validation for continuous improvement
- Add A/B testing framework for features, prompts, and configuration
- Implement drift detection for accuracy, latency, and other key metrics
- Establish model versioning and rollback capabilities for safe updates
Business Value:
- Enables system to improve accuracy over time through learning from user interactions
- Reduces annotation costs through intelligent sample selection for labeling
- Ensures model improvements are validated before deployment
- Enables data-driven optimization through experimentation framework
- Provides early warning of performance degradation through drift detection
- Supports safe model updates through versioning and rollback capabilities
- Reduces total cost of ownership through continuous optimization
- Increases user satisfaction through improving accuracy and relevance
Dependencies: Phase 8 (Security, Compliance & Cost Management)
Files/Modules Affected:
- backend/services/feedback-collector.py (NEW) - Mechanism for collecting user corrections and reviews
- backend/services/active-learning.py (NEW) - Uncertainty sampling and active learning algorithms
- backend/services/retraining-pipeline.py (NEW) - Model retraining pipeline with validation
- backend/services/experiment-framework.py (NEW) - A/B testing framework for features and configuration
- backend/services/drift-detector.py (NEW) - Drift detection for accuracy, latency, and key metrics
- backend/services/model-registry.py (NEW) - Model versioning, storage, and rollback capabilities
- backend/services/sample-manager.py (NEW) - Management of labelled and unlabelled samples
- backend/services/labeling-queue.py (NEW) - Queue for sending samples to labeling effort
- backend/services/training-orchestrator.py (NEW) - Orchestration of model training jobs
- backend/services/validation-suite.py (NEW) - Validation suite for model evaluation
- backend/services/document_registry.py - Extended to store model performance metadata per document type
- backend/services/ocr_engine.py - Extended to support model versioning and hot swapping
- backend/services/prompt-service.py - Extended to support A/B testing of prompts
- backend/services/configuration.py - Extended to support feature flag experiments
- frontend/src/lib/feedback-widgets.ts (NEW) - Components for collecting user feedback and corrections
- frontend/src/lib/experiment-manager.ts (NEW) - Frontend component for experiment enrollment and tracking
Engineering Risks:
- Medium: Feedback loop latency affecting real-time decisions - Mitigation: Asynchronous processing, batching, prioritization
- Medium: Model retraining failure or degradation - Mitigation: Rigorous validation, canary deployment, rollback capabilities
- Medium: Active learning sample bias - Mitigation: Diversity constraints, exploration-exploitation balance
- Medium: Experimentation complexity and confounding factors - Mitigation: Proper experimental design, statistical significance testing
- Low: Drift detection false positives/negatives - Mitigation: Multiple detection methods, confirmation windows, baselines
- Low: Storage growth from sample accumulation - Mitigation: Sample pruning, aggregation, retention policies
Testing Strategy:
- Unit tests for all new continuous learning and optimization components
- Integration tests verifying feedback collection, active learning, and retraining pipeline
- A/B testing framework validation with traffic splitting and metric collection
- Model retraining pipeline validation with sample data and comparison to baseline
- Drift detection sensitivity and specificity tests with known degradation scenarios
- Sample management tests verifying correct labeling queue prioritization
- Experiment framework validation with proper statistical significance testing
- Security tests for feedback and experiment endpoints
- Chaos engineering tests for learning system failure scenarios
- Backward compatibility tests for model versioning and rollback
Rollback Strategy:
- Feature Flags (per learning component):
- OCR_USE_FEEDBACK_COLLECTOR (default: false → true)
- OCR_USE_ACTIVE_LEARNING (default: false → true)
- OCR_USE_RETRAINING_PIPELINE (default: false → true)
- OCR_USE_EXPERIMENT_FRAMEWORK (default: false → true)
- OCR_USE_DRIFT_DETECTOR (default: false → true)
- OCR_USE_MODEL_REGISTRY (default: false → true)
- Selective Rollback: 
- Feedback collection: Can disable collection while retaining existing samples
- Active learning: Can fall back to passive learning or random sampling
- Retraining pipeline: Can continue using existing models
- Experiment framework: Can disable experiments, revert to control variants
- Drift detector: Can disable alerts while retaining detection capability
- Model registry: Can disable versioning while retaining current models
- Instant Rollback: Disable flags to revert to static, non-learning system
- Gradual Rollout: 
- Deploy learning elements alongside static version
- Route percentage of traffic or samples to learning system
- Monitor accuracy improvements and resource utilization
- Gradually increase adoption based on measured benefits
- Data Preservation: 
- Feedback samples can be anonymized and retained for historical analysis
- Active learning models can be disabled while keeping current models
- Experiment data can be archived for analysis
- Model versioning can be disabled while retaining current model versions
- No destructive data changes required for rollback
Success Criteria:
- Feedback loop capturing ≥ 5% of low-confidence results (<0.6 confidence)
- Active learning reducing uncertainty (entropy) over time in processed documents
- Retraining pipeline producing validated model updates with ≥ 2% relative accuracy improvement
- Experiment framework enabling safe innovation with measurable impact on key metrics
- Drift detector alerting on significant metric changes (>5% deviation from baseline) with low false positive rate
- Model versioning and rollback capabilities functional for safe updates
Acceptance Criteria:
- Feedback collection mechanism captures user corrections and reviews with context
- Active learning prioritizes uncertain samples (high entropy, low confidence, boundary cases)
- Labeling queue efficiently feeds samples to human annotators based on prioritization
- Retraining pipeline trains models, validates against holdout set, and compares to baseline
- Experiment framework properly splits traffic, collects metrics, and determines statistical significance
- Drift detector uses multiple methods (EWM, CUSOM, threshold) and confirms alerts over windows
- Model registry stores model versions with metadata and enables rollback to previous versions
- OCR engine supports hot swapping of model versions without downtime
- Prompt service supports A/B testing of prompt variants with traffic splitting
- Configuration system supports feature flag experiments with control/treatment groups
- Frontend feedback widgets enable easy correction submission with context
- Frontend experiment manager displays experiment enrollment and allows opt-out where applicable
- System shows measurable accuracy improvement over time (≥ 1% per month after initial learning period)
- Annotation effort reduced by ≥ 20% through active learning vs random sampling
- Experiment framework enables innovation with < 5% risk of degrading key metrics
- Drift detector provides early warning (≥ 1 week) before metric degradation impacts SLAs
- Model rollback restores previous performance within 10 minutes of initiation
- Security review completed for all new service endpoints
- Dependency scanning shows no known vulnerable packages in use
Definition of Done:
- Feedback collection mechanism implemented for user corrections and reviews
- Active learning algorithm implemented for uncertain sample prioritization
- Model retraining pipeline implemented with validation and comparison to baseline
- Experiment framework implemented for A/B testing of features and configuration
- Drift detection implemented for accuracy, latency, and key metrics
- Model registry implemented for versioning, storage, and rollback capabilities
- Sample management and labeling queue implemented
- Training orchestrator and validation suite implemented
- OCR engine extended to support model versioning and hot swapping
- Prompt service extended to support A/B testing of prompts
- Configuration system extended to support feature flag experiments
- Frontend feedback widgets and experiment manager implemented
- Feature flags for each learning component implemented
- Unit tests for all new continuous learning/optimization components (>80% coverage each)
- Integration tests verifying feedback collection, active learning, and retraining pipeline
- A/B testing framework validated with traffic splitting and metric collection
- Model retraining pipeline validated with sample data and comparison to baseline
- Drift detection sensitivity and specificity validated with known degradation scenarios
- Model rollback tested and verified to restore previous performance
- Experiment framework validated with proper statistical significance testing
- Security review completed for all new service endpoints
- Documentation updated for all continuous learning and optimization components
- Knowledge transfer session conducted with backend, ML, DevOps, and platform teams
- Deployment documentation updated for learning-enabled production deployment
Phase 10: Hardening & Documentation
Purpose: Finalize, harden, and document the system to ensure production readiness, security, and knowledge transfer.
Objectives:
- Conduct comprehensive security audit and penetration testing
- Finalize operational runbooks, playbooks, and incident response procedures
- Create comprehensive API and integration documentation
- Conduct performance optimization pass to meet all SLAs
- Execute knowledge transfer to operations, support, and product teams
- Establish long-term maintenance and evolution procedures
Business Value:
- Ensures production readiness through comprehensive validation and hardening
- Reduces risk of production incidents through proactive security and reliability measures
- Enables efficient troubleshooting and incident response through documented procedures
- Supports customer and partner integration through comprehensive documentation
- Ensures operational sustainability through knowledge transfer and procedures
- Establishes foundation for long-term evolution and enhancement
- Builds confidence in system reliability, security, and performance
Dependencies: Phase 9 (Continuous Learning & Optimization)
Files/Modules Affected: 
All files and modules (final review, polishing, and documentation)
- backend/ - All backend services and utilities
- frontend/ - All frontend components and utilities
- docs/ - Comprehensive documentation
- runbooks/ - Operational procedures and incident response
- playbooks/ - Specific scenario response guides
- api/ - API specifications and contract definitions
- testing/ - Test suites and test data
- deployment/ - Deployment manifests and procedures
- monitoring/ - Monitoring dashboards and alerting rules
- security/ - Security policies, procedures, and scan results
- compliance/ - Compliance documentation and evidence
Engineering Risks:
- Low: Overlooking critical security vulnerability - Mitigation: Comprehensive external penetration testing, code review, threat modeling
- Low: Performance regression from optimizations - Mitigation: Regression testing against baseline, benchmarking
- Low: Documentation incompleteness or inaccuracy - Mitigation: Documentation reviews, user testing, traceability matrix
- Low: Knowledge transfer gaps - Mitigation: Structured sessions, hands-on labs, assessment, feedback
- Low: Operational procedure gaps - Mitigation: Tabletop exercises, walkthroughs, drills, feedback incorporation
Testing Strategy:
- Comprehensive security audit (internal and external penetration testing)
- Performance benchmarking against all SLAs and targets
- Load testing to validate sustained performance under expected and peak loads
- Stress testing to identify breaking points and recovery mechanisms
- Soak testing to detect memory leaks and resource exhaustion over time
- Chaos engineering tests for various failure scenarios (infrastructure, network, application)
- Functional testing to validate all features and user workflows
- Regression testing to ensure no functionality broken during hardening
- Documentation review and validation with target audiences
- Knowledge transfer assessment and feedback collection
- Operational procedure validation through tabletop exercises and drills
- Compliance validation against target regulations and standards
- Accessibility validation (WCAG 2.1 AA) and responsive design testing
- Internationalization and localization testing (if applicable)
- Dependency validation and license compliance check
Rollback Strategy:
- N/A: Final production release - Rollback would involve redeploying previous known-good version
- Prepared Rollback: 
- Previous version containers/images retained for rapid rollback
- Database backups maintained for point-in-time recovery
- Feature flags and configuration can revert to known-good states
- Rollback procedures documented and tested
- Rollback window defined (typically 24-48 hours post-deployment)
- Data Preservation: 
- Backup and restore procedures validated
- Point-in-time recovery capabilities verified
- No destructive data model changes requiring complex migration
Success Criteria:
- All security findings from audit and penetration testing addressed or mitigated
- Performance meets all targets (latency ≤ 2s 95th percentile, throughput ≥ 100 docs/minute, cost ≤ $0.005/page)
- Documentation complete, accurate, and accessible to target audiences
- Support team trained and confident in system operation and troubleshooting
- System ready for production launch with monitoring, alerting, and support procedures in place
- Long-term maintenance and evolution procedures established
Acceptance Criteria:
- Security audit shows no critical or high severity findings
- Penetration testing reveals no exploitable vulnerabilities
- All identified security issues resolved or mitigated with acceptable risk
- Performance benchmarks show:
- 95th percentile request latency ≤ 2 seconds
- Sustained throughput ≥ 100 documents per minute
- Average cost per document ≤ $0.005
- Availability ≥ 99.5% during planned maintenance windows
- Recovery time objective (RTO) ≤ 5 minutes for unplanned failures
- Documentation complete and accurate:
- API reference documentation comprehensive and up-to-date
- Integration guides for all major systems and platforms
- Operational runbooks cover startup, shutdown, backup, recovery procedures
- Playbooks cover specific failure scenarios and incident response
- User guides cover all features and workflows
- Developer guides cover extension and customization points
- Deployment guides cover all target environments
- Support team demonstrates competency in:
- System startup, shutdown, and health check procedures
- Basic troubleshooting and diagnostic procedures
- Backup and recovery procedures
- Performance monitoring and optimization procedures
- Security incident response procedures
- Feature flag and configuration management procedures
- Knowledge transfer assessment shows ≥ 80% competency in core system operation
- Operational procedures validated through tabletop exercises and drills
- Compliance validation shows adherence to target regulations (GDPR, CCPA, industry-specific as applicable)
- Accessibility audit passes WCAG 2.1 AA standards
- Responsive design verified across target device breakpoints
- Internationalization/localization validated (if applicable)
- All dependencies validated for license compatibility and absence of known vulnerabilities
Definition of Done:
- Security audit completed with no critical/high findings
- Penetration testing completed with no exploitable vulnerabilities
- All security issues resolved or mitigated with acceptable risk
- Performance benchmarks meet all SLAs and targets
- Load, stress, and soak testing completed successfully
- Chaos engineering tests for failure scenarios passed
- Functional testing validates all features and user workflows
- Regression testing confirms no functionality broken
- Documentation review confirms completeness and accuracy for target audiences
- Support team training completed with competency assessment
- Knowledge transfer assessment shows ≥ 80% core competency
- Operational procedures validated through tabletop exercises and drills
- Compliance validation confirms adherence to target regulations
- Accessibility audit passes WCAG 2.1 AA standards
- Responsive design verified across target device breakpoints
- Internationalization/localization validated (if applicable)
- Dependency validation confirms license compatibility and no known vulnerabilities
- Deployment procedures tested and validated
- Rollback procedures documented and tested
- Long-term maintenance and evolution procedures established
- System declared ready for production launch with go/no-go criteria met
Now I'll create Document 3: OCR Implementation Back
OCR IMPLEMENTATION BACKLOG
Epic: Foundation & Observability
Description: Establish monitoring, logging, and foundational services to create a measurable, observable baseline for the transformation.
Feature: Structured Logging Implementation
Description: Implement structured logging with trace ID propagation across all services for observability and debugging.
- Tasks:
- Design structured log format (JSON) with required fields: timestamp, level, message, trace_id, service_name, span_id
- Implement logging utility in backend/logging.py with trace context propagation
- Update all services to use new logging utility
- Configure log rotation and retention policies
- Implement request/response middleware for automatic trace ID generation
- Subtasks:
- Define log schema and fields
- Create logging utility with trace context
- Update authentication service to use structured logging
- Update configuration service to use structured logging
- Update metrics service to use structured logging
- Update worker pool service to use structured logging
- Update message queue service to use structured logging
- Update cache service to use structured logging
- Update API middleware for trace ID generation
- Configure log rotation (daily) and retention (30 days)
- Acceptance Criteria:
- All services emit JSON logs with trace_id and span_id fields
- Logs include service_name and severity level
- Trace IDs propagate across service boundaries
- Log rotation configured and functioning
- No sensitive data leaked in logs (PII, credentials, etc.)
- Testing:
- Unit tests for logging utility (>90% coverage)
- Integration tests verifying trace ID propagation
- Security test for log output (no PII/credentials leakage)
- Performance test confirming <1% overhead
- Estimated Complexity: Low
- Dependencies: None
- Priority: P0 (Foundation)
Feature: Prometheus Metrics Implementation
Description: Add comprehensive Prometheus metrics for latency, throughput, error rates, and resource utilization.
- Tasks:
- Define core metrics: request duration, request count, error count, active requests, resource utilization
- Implement metrics collection utility in backend/metrics.py
- Add metrics instrumentation to all service entry/exit points
- Configure Prometheus endpoint exposition (/metrics)
- Set up initial Grafana dashboards for key metrics
- Subtasks:
- Define core metric names, labels, and help text
- Create metrics utility with counter, gauge, histogram types
- Instrument authentication service endpoints
- Instrument configuration service endpoints
- Instrument metrics service endpoints
- Instrument worker pool service endpoints
- Instrument message queue service endpoints
- Instrument cache service endpoints
- Instrument API routes for request duration and count
- Expose /metrics endpoint in main application
- Create initial Grafana dashboard with latency, throughput, error rate panels
- Acceptance Criteria:
- /metrics endpoint exposes Prometheus-formatted metrics
- Core metrics present: ocr_request_duration_seconds, ocr_requests_total, ocr_errors_total, ocr_active_requests
- Resource utilization metrics: CPU, memory, disk, network
- Metrics updated in real-time with service activity
- Grafana dashboard displays metrics correctly
- No cardinality explosion from excessive labels
- Testing:
- Unit tests for metrics utility (>90% coverage)
- Integration tests verifying metric collection and exposition
- Load test confirming metrics scale with load
- Security test confirming no sensitive data in metrics
- Performance test confirming <5% overhead
- Estimated Complexity: Low
- Dependencies: Structured Logging
- Priority: P0 (Foundation)
Feature: Centralized Configuration Management
Description: Create centralized configuration management system with feature flag infrastructure.
- Tasks:
- Design configuration hierarchy (defaults, environment, overrides)
- Implement configuration service in backend/config.py
- Add feature flag system with evaluation context
- Create configuration loading from environment, files, and Consul/etcd
- Build feature flag web UI for toggling and monitoring
- Implement configuration change notifications to services
- Subtasks:
- Define configuration schema and hierarchy
- Create configuration service with layered loading
- Implement feature flag evaluation with context
- Add environment variable configuration loading
- Add file-based configuration loading (YAML/JSON)
- Add Consul/etcd loading (optional, for distributed)
- Implement feature flag service with evaluation
- Create feature flag web UI (React/Vue)
- Add change notification mechanism (pub/sub or polling)
- Update all services to use centralized configuration
- Implement configuration validation at startup
- Acceptance Criteria:
- Configuration loads from environment variables
- Configuration loads from YAML/JSON files
- Feature flags evaluable with context (user, org, etc.)
- Feature flag web UI allows toggling and monitoring
- Services receive configuration change notifications
- Configuration validation prevents invalid startup
- No service restart required for flag changes (hot reload)
- Testing:
- Unit tests for configuration service (>90% coverage)
- Integration tests verifying layered loading and overrides
- Feature flag testing with various contexts
- Change notification tests verifying service updates
- Validation test ensuring invalid configs rejected at startup
- Performance test confirming <2% overhead
- Estimated Complexity: Low
- Dependencies: Structured Logging
- Priority: P0 (Foundation)
Feature: Baseline Performance Measurements
Description: Establish baseline performance measurements for all critical paths.
- Tasks:
- Identify critical paths (ingestion, classification, OCR, validation, response)
- Instrument timing measurements at key points in pipeline
- Create baseline measurement collection and storage
- Establish measurement retention and reporting schedule
- Build baseline comparison dashboard in Grafana
- Subtasks:
- Identify and document critical processing paths
- Add timing instrumentation to ingestion service
- Add timing instrumentation to classification service
- Add timing instrumentation to OCR engine service
- Add timing instrumentation to validation service
- Add timing instrumentation to response service
- Create baseline measurement storage (Redis/TSDB)
- Implement measurement collection agent
- Establish hourly/daily measurement collection schedule
- Create baseline comparison dashboard
- Set up alerting for significant deviations from baseline
- Acceptance Criteria:
- Timing measurements collected for all critical paths
- Baseline measurements stored with timestamps
- Measurement collection runs on schedule (hourly/daily)
- Baseline dashboard shows current vs baseline performance
- Deviation alerting functions correctly
- Measurements include latency, throughput, and resource utilization
- Testing:
- Unit tests for timing instrumentation
- Integration tests verifying end-to-end timing measurement
- Load test confirming measurement accuracy under load
- Retention test confirming measurement storage duration
- Dashboard test verifying correct baseline comparison
- Alert test confirming deviation detection
- Estimated Complexity: Low
- Dependencies: Structured Logging, Prometheus Metrics
- Priority: P0 (Foundation)
Epic: Classification Integration
Feature: Enhanced Document Classifier
Description: Enhance DocumentClassifier to return confidence scores with predictions.
- Tasks:
- Modify classifier interface to return (prediction, confidence) tuples
- Implement confidence scoring using model probabilities or heuristic methods
- Add confidence thresholding logic for decision making
- Update classifier model loading and inference code
- Add confidence calibration if using heuristic methods
- Subtasks:
- Define classifier return type (prediction, confidence_score)
- Modify backend/services/classifier.py interface
- Implement probability-based confidence for ML models
- Implement heuristic-based confidence with calibration
- Add confidence threshold constants (auto_accept, review_required)
- Update model loading and inference code
- Add confidence calibration procedure if needed
- Update classifier service to return tuples
- Acceptance Criteria:
- Classifier returns tuple (document_type_id, confidence_score)
- Confidence score is float between 0.0 and 1.0
- Confidence correlates with actual prediction accuracy
- Thresholds defined for auto-accept (≥0.85) and review_required (≥0.60)
- Classifier handles unknown documents appropriately
- Testing:
- Unit tests for classifier return types (>90% coverage)
- Integration tests verifying confidence-score accuracy correlation
- Threshold validation tests
- Calibration accuracy tests (if applicable)
- Edge case tests for unknown/ambiguous documents
- Estimated Complexity: Medium
- Dependencies: Foundation & Observability
- Priority: P0 (Immediate Value)
Feature: Classification Pipeline Orchestrator
Description: Create ClassificationPipeline orchestrator to manage multi-stage classification with fallback logic.
- Tasks:
- Design multi-stage classification pipeline (pre-flight, fast OCR, text classification, visual validation)
- Implement orchestrator in backend/services/classification_pipeline.py
- Add stage execution logic with timing and error handling
- Implement confidence-based fallback logic between stages
- Add stage-specific timeout and retry mechanisms
- Subtasks:
- Define pipeline stages and interfaces
- Create ClassificationPipeline class
- Implement pre-flight analysis stage (image-only)
- Implement fast OCR stage (Tesseract, <500ms)
- Implement text classification stage (existing classifier)
- Implement visual validation stage (optional layout-aware model)
- Add confidence-based fallback logic between stages
- Implement stage timeout and retry mechanisms
- Add pipeline metrics collection (latency, stage usage)
- Create pipeline configuration for stage enabling/disabling
- Acceptance Criteria:
- Pipeline executes stages in order with timing
- Confidence-based fallback works between stages
- Stages can be enabled/disabled via configuration
- Pipeline metrics collected (latency per stage, usage)
- Timeouts and retries function correctly per stage
- Final result includes classification confidence
- Testing:
- Unit tests for pipeline class and stages (>90% coverage)
- Integration tests verifying stage execution and fallback
- Configuration test for stage enabling/disabling
- Timeout and retry tests
- Metrics collection tests
- Edge case tests for stage failures and timeouts
- Estimated Complexity: Medium
- Dependencies: Enhanced Document Classifier
- Priority: P0 (Immediate Value)
Feature: Document Registry Implementation
Description: Create central document type registry for storing type definitions, schemas, and processing rules.
- Tasks:
- Design DocumentTypeConfig data model
- Implement registry service in backend/services/document_registry.py
- Add CRUD operations for document types
- Implement versioning and migration support
- Add caching for frequent lookups
- Create initial registry entries for existing document types
- Subtasks:
- Define DocumentTypeConfig data model
- Create registry service with storage backend
- Implement create, read, update, delete operations
- Add versioning support for config evolution
- Add migration support between versions
- Implement caching layer (LRU or TTL-based)
- Create initial entries for GST invoice, delivery note, weighbridge
- Add entries for PO, GRN, material receipt, packing list, etc.
- Implement registry validation at startup
- Add registry metrics (hit rate, lookup latency)
- Acceptance Criteria:
- Registry supports CRUD operations on document types
- Versioning allows config evolution without breaking changes
- Caching improves lookup performance for frequent lookup performance
- Initial entries created for all existing document types
- Registry validation prevents invalid configurations
- Registry metrics collected (hit rate, latency)
- Testing:
- Unit tests for registry service (>90% coverage)
- Integration tests verifying CRUD operations
- Versioning test for safe config evolution
- Caching test verifying performance improvement
- Initial entry validation for all existing types
- Validation test rejecting invalid configurations
- Metrics test confirming collection and reporting
- Estimated Complexity: Medium
- Dependencies: Enhanced Document Classifier, Classification Pipeline
- Priority: P0 (Immediate Value)
Feature: Pipeline Classification Integration
Description: Modify OCR pipeline to call classification before engine selection.
- Tasks:
- Update _run_table_preview_pipeline in backend/routers/ocr/_common.py
- Update build_structured_ocr_result in backend/services/ocr_document_pipeline.py
- Add classification call before engine selection/routing
- Pass classification results to engine selection logic
- Handle classification failures and fallbacks
- Subtasks:
- Update _run_table_preview_pipeline to call classification pipeline
- Extract classification results (type_id, confidence)
- Pass results to engine selection logic
- Update build_structured_ocr_result similarly
- Add error handling for classification failures
- Implement fallback to generic processing on failure
- Add metrics for classification usage and accuracy
- Update any other pipeline entry points
- Acceptance Criteria:
- Classification called before engine selection in all pipeline paths
- Classification results passed to engine selection logic
- Classification failures handled gracefully with fallback
- Engine selection receives classification type and confidence
- Metrics collected for classification usage and accuracy
- No disruption to existing pipeline functionality
- Testing:
- Unit tests for pipeline modifications
- Integration tests verifying classification before engine selection
- Error handling test for classification failures
- Fallback test verifying graceful degradation to generic processing
- Metrics test confirming classification usage collection
- Regression test ensuring existing functionality intact
- Estimated Complexity: Medium
- Dependencies: Enhanced Document Classifier, Classification Pipeline, Document Registry
- Priority: P0 (Immediate Value)
Feature: Frontend Routing Update
Description: Update frontend routing to use classification results for document type detection.
- Tasks:
- Update DocumentTypeResolver in frontend to use OCR result classification
- Modify routing logic to prioritize OCR result type over doc_type_hint
- Handle cases where classification fails or returns unknown
- Update any other frontend type detection logic
- Subtasks:
- Update frontend DocumentTypeResolver logic
- Prioritize OCR result document_type over doc_type_hint
- Handle missing/null classification results
- Handle unknown classification results
- Update any other frontend type detection
- Add loading states for classification waiting
- Add error states for classification failures
- Acceptance Criteria:
- Frontend uses OCR result document_type when available
- Falls back to doc_type_hint when classification unavailable
- Handles unknown classifications appropriately (generic view)
- Shows loading states during classification
- Shows error states for classification failures
- No disruption to existing frontend functionality
- Testing:
- Unit tests for DocumentTypeResolver (>90% coverage)
- Integration tests verifying correct routing with classification
- Loading state test
- Error state test for classification failures
- Fallback test to doc_type_hint when classification missing
- Regression test ensuring existing routing intact
- Estimated Complexity: Low
- Dependencies: Pipeline Classification Integration
- Priority: P0 (Immediate Value)
Feature: Classification Pipeline Feature Flag
Description: Implement feature flag for safe rollout of classification pipeline.
- Tasks:
- Add feature flag OCR_USE_CLASSIFIER_PIPELINE to configuration
- Wrap classification pipeline calls with flag check
- Implement legacy pipeline bypass when flag disabled
- Create metrics to compare legacy vs new pipeline performance
- Set default to false for safe rollout
- Subtasks:
- Add feature flag to configuration system
- Wrap _run_table_preview_pipeline classification call
- Wrap build_structured_ocr_result classification call
- Implement legacy bypass when flag disabled
- Add metrics comparison (legacy vs new pipeline)
- Set default value to false
- Create rollback procedure documentation
- Acceptance Criteria:
- Feature flag OCR_USE_CLASSIFIER_PIPELINE controls usage
- When false, uses legacy processing (no classification)
- When true, uses new classification pipeline
- Metrics compare legacy vs new pipeline performance
- Default value is false for safe initial rollout
- Rollback procedure documented
- Testing:
- Unit tests for feature flag wrapping
- Integration tests verifying flag behavior
- Default value test (false)
- Metrics comparison test
- Rollback procedure test
- Estimated Complexity: Low
- Dependencies: Pipeline Classification Integration
- Priority: P0 (Immediate Value)
Epic: Registry-Driven Prompts & Schema
Feature: Document Registry Extension
Description: Extend document registry to store prompts and JSON schemas for document types.
- Tasks:
- Extend DocumentTypeConfig model to include prompts and schemas
- Add validation for prompt and schema fields
- Implement prompt and schema retrieval methods
- Add versioning support for prompts and schemas
- Migrate existing hardcoded prompts and schemas to registry
- Subtasks:
- Extend DocumentTypeConfig with prompt_template and json_schema fields
- Add validation for prompt (non-empty string) and schema (valid JSON)
- Implement get_prompt() and get_schema() methods
- Add versioning support for prompt and schema evolution
- Create migration script for hardcoded prompts to registry
- Migrate GST invoice prompt and schema
- Migrate delivery note prompt and schema
- Migrate weighbridge prompt and schema
- Migrate PO, GRN, material receipt, packing list entries
- Add validation for prompt and schema in registry
- Implement version history tracking
- Acceptance Criteria:
- DocumentTypeConfig includes prompt_template and json_schema fields
- Validation ensures prompt is non-empty string and schema is valid JSON
- Retrieval methods return correct prompt and schema
- Versioning supports evolution without breaking changes
- All existing document types migrated to registry
- Registry validation prevents invalid prompt/schema entries
- Testing:
- Unit tests for DocumentTypeConfig extension (>90% coverage)
- Integration tests verifying prompt and schema storage/retrieval
- Validation test for prompt and schema requirements
- Versioning test for safe evolution
- Migration test verifying all existing types moved
- Registry validation test for invalid entries
- Estimated Complexity: Medium
- Dependencies: Document Registry Implementation
- Priority: P1 (After Classification)
Feature: Prompt Service Implementation
Description: Create prompt rendering engine with variable substitution, version control, and A/B testing support.
- Tasks:
- Design prompt service interface
- Implement prompt service in backend/services/prompt_service.py
- Add variable substitution engine (Handlebars/Mustache style)
- Implement version control and retrieval
- Add A/B testing framework for prompt variants
- Create prompt caching for performance
- Subtasks:
- Define PromptService interface
- Create PromptService class with variable substitution
- Implement Handlebars/Mustache style variable substitution
- Add version control for prompts (storage, retrieval, listing)
- Implement A/B testing framework (traffic splitting, metrics)
- Add prompt caching (LRU or TTL-based)
- Create default prompt templates for existing types
- Add prompt validation (length, safety, etc.)
- Implement prompt metrics (usage, cache hit rate)
- Acceptance Criteria:
- Prompt service correctly substitutes variables in templates
- Variable substitution follows Handlebars/Mustache syntax
- Version control stores and retrieves prompt versions
- A/B testing framework splits traffic and collects metrics
- Prompt caching improves performance for repeated use
- Default templates created for existing document types
- Prompt validation rejects unsafe or invalid templates
- Metrics collected for usage and cache performance
- Testing:
- Unit tests for prompt service (>90% coverage)
- Integration tests verifying variable substitution and versioning
- A/B testing test verifying traffic splitting and metrics
- Caching test verifying performance improvement
- Default templates test for existing document types
- Validation test for prompt safety and validity
- Metrics test confirming collection and reporting
- Estimated Complexity: Medium
- Dependencies: Document Registry Extension
- Priority: P1 (After Classification)
Feature: Validation Service Implementation
Description: Create validation service with schema validation and anti-injection layers.
- Tasks:
- Design validation service interface
- Implement validation service in backend/services/validation_service.py
- Add JSON schema validation (using ajv or similar)
- Implement anti-injection hardening layers
- Add validation metrics and error formatting
- Subtasks:
- Define ValidationService interface
- Create ValidationService class
- Implement JSON schema validation
- Add anti-injection layer 1: input regex sanitization
- Add anti-injection layer 2: system prompt hardening
- Add anti-injection layer 3: output schema validation
- Add anti-injection layer 4: value range validation
- Add anti-injection layer 5: cross-validation against Tesseract
- Implement validation metrics (pass/fail rates, error types)
- Add error formatting for client consumption
- Create default validation rules for existing types
- Add validation caching for performance
- Acceptance Criteria:
- Validation service validates JSON against schema
- Anti-injection layer 1 sanitizes dangerous input patterns
- Anti-injection layer 2 hardens system prompts
- Anti-injection layer 3 validates output structure
- Anti-injection layer 4 validates value ranges
- Anti-injection layer 5 performs cross-validation
- Validation metrics collected (pass/fail, error types)
- Error formatting produces client-consumable results
- Default validation rules created for existing types
- Validation caching improves performance
- Testing:
- Unit tests for validation service (>90% coverage)
- Integration tests verifying schema validation and anti-injection
- Anti-injection layer tests (1-5)
- Validation metrics test
- Error formatting test
- Default validation rules test
- Validation caching test
- Estimated Complexity: Medium
- Dependencies: Document Registry Extension
- Priority: P1 (After Classification)
Feature: Prompt Integration in OCR Pipeline
Description: Modify OCR pipeline to use registry-driven prompts and validation.
- Tasks:
- Update _call_table_excel_anthropic in backend/routers/ocr/_common.py
- Update build_structured_ocr_result in backend/services/ocr_document_pipeline.py
- Replace hardcoded prompts with registry-driven prompt service
- Replace ad-hoc validation with validation service
- Handle service failures and fallbacks
- Subtasks:
- Update _call_table_excel_anthropic to use prompt service
- Get prompt from registry via prompt service
- Update build_structured_ocr_result to use validation service
- Replace hardcoded validation with validation service
- Add error handling for prompt/service failures
- Implement fallback to hardcoded prompts/validation
- Add metrics for service usage and failures
- Update any other pipeline entry points
- Acceptance Criteria:
- OCR pipeline uses prompt service for prompt generation
- Prompt retrieved from registry via document type
- OCR pipeline uses validation service for validation
- Service failures handled gracefully with fallbacks
- Metrics collected for service usage and failures
- No disruption to existing pipeline functionality
- Testing:
- Unit tests for pipeline modifications
- Integration tests verifying prompt service usage
- Integration tests verifying validation service usage
- Service failure test (prompt service unavailable)
- Fallback test to hardcoded prompts/validation
- Metrics test confirming service usage collection
- Regression test ensuring existing functionality intact
- Estimated Complexity: Medium
- Dependencies: Prompt Service Implementation, Validation Service Implementation
- Priority: P1 (After Classification)
Feature: Prompt Service Feature Flags
Description: Implement feature flags for safe rollout of prompt and validation services.
- Tasks:
- Add feature flag OCR_USE_REGISTRY_PROMPTS to configuration
- Wrap prompt service calls with flag check
- Wrap validation service calls with flag check
- Implement legacy fallback when flags disabled
- Create metrics to compare legacy vs new pipeline
- Set default to false for safe rollout
- Subtasks:
- Add feature flag to configuration system
- Wrap _call_table_excel_anthropic prompt service call
- Wrap build_structured_ocr_result validation service call
- Implement legacy fallback (hardcoded prompts/validation)
- Add metrics comparison (legacy vs new pipeline)
- Set default value to false
- Create rollback procedure documentation
- Acceptance Criteria:
- Feature flag OCR_USE_REGISTRY_PROMPTS controls usage
- When false, uses legacy prompts and validation
- When true, uses registry-driven services
- Metrics compare legacy vs new pipeline performance
- Default value is false for safe initial rollout
- Rollback procedure documented
- Testing:
- Unit tests for feature flag wrapping
- Integration tests verifying flag behavior
- Default value test (false)
- Metrics comparison test
- Rollback procedure test
- Estimated Complexity: Low
- Dependencies: Prompt Integration in OCR Pipeline
- Priority: P1 (After Classification)
Epic: Pluggable OCR Engine Layer
Feature: OCREngine Interface Definition
Description: Define standard OCREngine interface as contract for all OCR implementations.
- Tasks:
- Design OCREngine interface with standard methods
- Define input/output data models
- Specify error handling and timeout contracts
- Add capability reporting (languages, handwriting, layout understanding)
- Create interface documentation and examples
- Subtasks:
- Define OCREngine abstract base class
- Define process() method signature (image, options) -> OCRResult
- Define get_capabilities() method
- Define health_check() method
- Define shutdown() method
- Create input data model (OCRInput)
- Create output data model (OCRResult)
- Define error types and handling contracts
- Add capability flags (handwriting, multi_language, layout_understanding)
- Write interface documentation and implementation examples
- Acceptance Criteria:
- OCREngine interface defined with required methods
- Input and output data models specified
- Error handling and timeout contracts defined
- Capability reporting included
- Documentation and examples provided
- Testing:
- Unit tests for interface definition
- Contract test verifying interface compliance
- Documentation review for clarity and completeness
- Estimated Complexity: Low
- Dependencies: Foundation & Observability, Classification Integration, Registry-Driven Prompts & Schema
- Priority: P2 (After Registry-Driven Prompts & Schema)
Feature: OCR Engine Registry Implementation
Description: Create engine registry for registering and looking up OCR engines.
- Tasks:
- Design OCREngineRegistry data model
- Implement registry service in backend/services/ocr_engine_registry.py
- Add registration, lookup, and listing operations
- Implement engine metadata storage (capabilities, cost, performance)
- Add versioning support for engine updates
- Create initial registrations for Tesseract, Donut, Azure Read
- Subtasks:
- Define OCREngineRegistry data model
- Create registry service with storage backend
- Implement register_engine() operation
- Implement get_engine() and list_engines() operations
- Add metadata storage (capabilities, cost, performance profiles)
- Implement versioning support
- Register Tesseract engine (baseline)
- Register Donut engine (vision model)
- Register Azure Read engine (cloud API)
- Add engine validation at startup
- Implement registry metrics (hit rate, lookup latency)
- Acceptance Criteria:
- Registry supports engine registration and lookup
- Engine metadata stored (capabilities, cost, performance)
- Versioning supports engine updates
- Initial registrations created for Tesseract, Donut, Azure Read
- Engine validation prevents invalid registrations
- Registry metrics collected (hit rate, latency)
- Testing:
- Unit tests for engine registry (>90% coverage)
- Integration tests verifying registration and lookup
- Metadata test verifying storage and retrieval
- Versioning test for engine updates
- Initial registrations test for three engines
- Validation test rejecting invalid engine definitions
- Metrics test confirming collection and reporting
- Estimated Complexity: Medium
- Dependencies: OCREngine Interface Definition
- Priority: P2 (After Registry-Driven Prompts & Schema)
Feature: Engine Router Implementation
Description: Implement intelligent engine selection logic based on document attributes and policies.
- Tasks:
- Design engine routing algorithm
- Implement engine router in backend/services/engine_router.py
- Add routing based on document type, quality, policies, and cost
- Implement fallback chains and circuit breaker integration
- Add routing metrics and analytics
- Subtasks:
- Define engine routing algorithm and factors
- Create EngineRouter class
- Implement document type-based routing
- Add quality-based routing (from pre-flight analysis)
- Add policy-based routing (budget, preferences, SLA)
- Add cost-based routing (optimize for cost/accuracy)
- Implement fallback chains (primary → secondary → tertiary)
- Add circuit breaker integration (open/half-open/closed states)
- Add routing metrics (selection latency, engine usage)
- Create routing configuration (policies, weights, thresholds)
- Implement routing validation at startup
- Acceptance Criteria:
- Router selects engine based on document type
- Router considers pre-flight analysis quality metrics
- Router respects policy-based routing (budget, preferences)
- Router optimizes for cost when accuracy requirements met
- Router implements fallback chains
- Router integrates with circuit breakers
- Routing metrics collected (selection latency, engine usage)
- Routing configuration validated at startup
- Testing:
- Unit tests for engine router (>90% coverage)
- Integration tests verifying type-based selection
- Integration tests verifying quality-based selection
- Integration tests verifying policy-based selection
- Integration tests verifying cost-based selection
- Integration tests verifying fallback chains
- Integration tests verifying circuit breaker integration
- Metrics test confirming collection and reporting
- Configuration test for routing validation
- Estimated Complexity: Medium
- Dependencies: OCREngine Registry Implementation
- Priority: P2 (After Registry-Driven Prompts & Schema)
Feature: Tesseract Engine Adapter
Description: Implement Tesseract OCR engine as first engine adapter.
- Tasks:
- Create Tesseract engine adapter in backend/services/tesseract_engine.py
- Implement OCREngine interface for Tesseract
- Add Tesseract-specific options (psm, oem, language, config)
- Implement subprocess execution with timeout
- Add Tesseract output parsing to OCRResult format
- Add Tesseract-specific preprocessing profile support
- Subtasks:
- Create TesseractEngine class implementing OCREngine
- Implement process() method with image and options
- Add Tesseract-specific options (psm, oem, lang, config)
- Implement subprocess execution with timeout
- Add Tesseract output parsing (hOCR or TSV to OCRResult)
- Implement error handling and timeout logic
- Add Tesseract-specific preprocessing profile support
- Add capability reporting (languages, limited handwriting)
- Create default preprocessing profile for Tesseract
- Add metrics (latency, success rate, OOM kills)
- Acceptance Criteria:
- TesseractEngine implements OCREngine interface
- process() method handles image and options correctly
- Tesseract-specific options supported (psm, oem, lang, config)
- Subprocess execution with timeout implemented
- Output parsed correctly to OCRResult format
- Error handling and timeout logic functional
- Preprocessing profile support implemented
- Capability reporting accurate (languages, basic handwriting)
- Default preprocessing profile created
- Metrics collected (latency, success rate)
- Testing:
- Unit tests for TesseractEngine (>90% coverage)
- Integration tests verifying OCREngine interface compliance
- Integration tests verifying Tesseract-specific options
- Integration tests verifying subprocess timeout handling
- Integration tests verifying output parsing
- Integration tests verifying error and timeout handling
- Integration tests verifying preprocessing profile support
- Capability reporting test
- Default preprocessing profile test
- Metrics test confirming collection and reporting
- Estimated Complexity: Medium
- Dependencies: OCREngine Interface Definition, OCR Engine Registry, Engine Router
- Priority: P2 (After Registry-Driven Prompts & Schema)
Feature: Donut Engine Adapter
Description: Implement Donut vision model engine as second engine adapter.
- Tasks:
- Create Donut engine adapter in backend/services/donut_engine.py
- Implement OCREngine interface for Donut
- Add Donut-specific options (model version, device, batch size)
- Implement model loading and inference
- Add Donut output parsing to OCRResult format
- Add Donut-specific preprocessing profile support
- Subtasks:
- Create DonutEngine class implementing OCREngine
- Implement process() method with image and options
- Add Donut-specific options (model, device, batch_size)
- Implement model loading and inference
- Add Donut output parsing (JSON to OCRResult)
- Implement error handling and timeout logic
- Add Donut-specific preprocessing profile support
- Add capability reporting (layout_understanding, multi_language)
- Create default preprocessing profile for Donut
- Add metrics (latency, success rate, GPU utilization)
- Acceptance Criteria:
- DonutEngine implements OCREngine interface
- process() method handles image and options correctly
- Donut-specific options supported (model, device, batch_size)
- Model loading and inference implemented
- Output parsed correctly to OCRResult format
- Error handling and timeout logic functional
- Preprocessing profile support implemented
- Capability reporting accurate (layout understanding, multi-language)
- Default preprocessing profile created
- Metrics collected (latency, success rate, GPU utilization)
- Testing:
- Unit tests for DonutEngine (>90% coverage)
- Integration tests verifying OCREngine interface compliance
- Integration tests verifying Donut-specific options
- Integration tests verifying model loading and inference
- Integration tests verifying output parsing
- Integration tests verifying error and timeout handling
- Integration tests verifying preprocessing profile support
- Capability reporting test
- Default preprocessing profile test
- Metrics test confirming collection and reporting
- Estimated Complexity: Medium
- Dependencies: OCREngine Interface Definition, OCR Engine Registry, Engine Router
- Priority: P2 (After Registry-Driven Prompts & Schema)
Feature: Azure Read Engine Adapter
Description: Implement Azure Computer Vision Read engine as third engine adapter.
- Tasks:
- Create Azure Read engine adapter in backend/services/azure_read_engine.py
- Implement OCREngine interface for Azure Read
- Add Azure Read-specific options (model version, language hints, features)
- Implement API client with authentication and retry logic
- Add Azure Read output parsing to OCRResult format
- Add Azure Read-specific preprocessing profile support
- Subtasks:
- Create AzureReadEngine class implementing OCREngine
- Implement process() method with image and options
- Add Azure Read-specific options (model, language_hints, features)
- Implement API client with authentication and retry logic
- Add Azure Read output parsing (JSON to OCRResult)
- Implement error handling and timeout logic
- Add Azure Read-specific preprocessing profile support
- Add capability reporting (handwriting, multi_language, layout_understanding)
- Create default preprocessing profile for Azure Read
- Add metrics (latency, success rate, API calls, cost)
- Acceptance Criteria:
- AzureReadEngine implements OCREngine interface
- process() method handles image and options correctly
- Azure Read-specific options supported (model, language_hints, features)
- API client with authentication and retry logic implemented
- Output parsed correctly to OCRResult format
- Error handling and timeout logic functional
- Preprocessing profile support implemented
- Capability reporting accurate (handwriting, multi-language, layout_understanding)
- Default preprocessing profile created
- Metrics collected (latency, success rate, API calls, cost)
- Testing:
- Unit tests for AzureReadEngine (>90% coverage)
- Integration tests verifying OCREngine interface compliance
- Integration tests verifying Azure Read-specific options
- Integration tests verifying API client and retry logic
- Integration tests verifying output parsing
- Integration tests verifying error and timeout handling
- Integration tests verifying preprocessing profile support
- Capability reporting test
- Default preprocessing profile test
- Metrics test confirming collection and reporting
- Estimated Complexity: Medium
- Dependencies: OCREngine Interface Definition, OCR Engine Registry, Engine Router
- Priority: P2 (After Registry-Driven Prompts & Schema)
Feature: Cost Tracker Implementation
Description: Implement per-engine cost monitoring and tracking.
- Tasks:
- Design cost tracking data model
- Implement cost tracker in backend/services/cost_tracker.py
- Add cost collection from engine adapters
- Implement cost aggregation and reporting
- Add budget tracking and alerting
- Subtasks:
- Define CostTracker data model
- Create CostTracker class
- Add cost collection from engine adapters (per invocation)
- Implement cost aggregation (total, per engine, per type)
- Add cost reporting (daily, weekly, monthly)
- Add budget tracking and alerting
- Create cost metrics (total_cost_usd, cost_per_request)
- Add cost forecasting based on historical usage
- Implement cost optimization suggestions
- Acceptance Criteria:
- Cost tracker collects costs from engine invocations
- Cost aggregation works (total, per engine, per document type)
- Cost reporting functions (daily, weekly, monthly)
- Budget tracking and alerting implemented
- Cost metrics exposed (total_cost_usd, cost_per_request)
- Cost forecasting based on historical usage
- Cost optimization suggestions provided
- Testing:
- Unit tests for cost tracker (>90% coverage)
- Integration tests verifying cost collection from engines
- Integration tests verifying cost aggregation and reporting
- Budget alerting test
- Cost forecasting test
- Cost optimization suggestions test
- Estimated Complexity: Low
- Dependencies: Tesseract, Donut, Azure Read Engine Adapters
- Priority: P2 (After Registry-Driven Prompts & Schema)
Feature: Circuit Breaker Implementation
Description: Implement circuit breaker pattern per engine for resilience.
- Tasks:
- Design circuit breaker data model and states
- Implement circuit breaker in backend/services/circuit_breaker.py
- Add failure detection and threshold logic
- Implement state transitions (closed → open → half-open → closed)
- Add timeout and recovery mechanisms
- Integrate with engine router for automatic fallback
- Subtasks:
- Define circuit breaker states (closed, open, half-open)
- Create CircuitBreaker class
- Implement failure detection and counting
- Add failure threshold logic for state transitions
- Implement state transition delays and timeouts
- Add half-open state test request logic
- Integrate with engine router for fallback
- Add metrics (state transitions, failure rates)
- Create default threshold configurations
- Acceptance Criteria:
- Circuit breaker implements states (closed, open, half-open)
- Failure detection and threshold logic functional
- State transitions work with timeouts and delays
- Half-open state test request logic implemented
- Integration with engine router for fallback functional
- Metrics collected (state transitions, failure rates)
- Default threshold configurations provided
- Testing:
- Unit tests for circuit breaker (>90% coverage)
- Integration tests verifying state transitions
- Failure detection and threshold tests
- State transition timing tests
- Half-open test request logic test
- Engine router integration test
- Metrics test confirming collection and reporting
- Estimated Complexity: Low
- Dependencies: Tesseract, Donut, Azure Read Engine Adapters
- Priority: P2 (After Registry-Driven Prompts & Schema)
Feature: Engine Integration in OCR Pipeline
Description: Modify OCR pipeline to use engine orchestrator instead of direct engine calls.
- Tasks:
- Update _call_table_excel_anthropic in backend/routers/ocr/_common.py
- Update build_structured_ocr_result in backend/services/ocr_document_pipeline.py
- Replace direct engine calls with engine orchestrator
- Pass document attributes and policies to router
- Handle orchestrator failures and fallbacks
- Subtasks:
- Update _call_table_excel_anthropic to use engine orchestrator
- Get engine selection from router based on document attributes
- Update build_structured_ocr_result similarly
- Add error handling for orchestrator failures
- Implement fallback to legacy direct engine calls
- Add metrics for engine selection and usage
- Update any other pipeline entry points
- Acceptance Criteria:
- OCR pipeline uses engine orchestrator for engine selection
- Engine selection based on document attributes and policies
- Orchestrator failures handled gracefully with fallback
- Metrics collected for engine selection and usage
- No disruption to existing pipeline functionality
- Testing:
- Unit tests for pipeline modifications
- Integration tests verifying engine orchestrator usage
- Integration tests verifying engine selection logic
- Orchestrator failure test
- Fallback test to legacy direct engine calls
- Metrics test confirming engine selection and usage
- Regression test ensuring existing functionality intact
- Estimated Complexity: Medium
- Dependencies: OCREngine Interface, OCR Engine Registry, Engine Router, Engine Adapters
- Priority: P2 (After Registry-Driven Prompts & Schema)
Feature: Engine Orchestrator Feature Flags
Description: Implement feature flags for safe rollout of engine orchestrator.
- Tasks:
- Add feature flag OCR_USE_PLUGGABLE_ENGINES to configuration
- Add per-engine flags (OCR_USE_TESSERACT, OCR_USE_DONUT, OCR_USE_AZURE_READ)
- Wrap engine orchestrator calls with flag check
- Implement legacy fallback when flags disabled
- Create metrics to compare legacy vs new pipeline
- Set defaults to false for safe rollout
- Subtasks:
- Add feature flags to configuration system
- Add per-engine flags for granular control
- Wrap _call_table_excel_anthropic orchestrator call
- Wrap build_structured_ocr_result orchestrator call
- Implement legacy fallback (direct engine calls)
- Add metrics comparison (legacy vs new pipeline)
- Set default values to false
- Create rollback procedure documentation
- Acceptance Criteria:
- Feature flag OCR_USE_PLUGGABLE_ENGINES controls usage
- When false, uses legacy direct engine calls
- When true, uses engine orchestrator
- Per-engine flags allow granular control
- Metrics compare legacy vs new pipeline performance
- Default values are false for safe initial rollout
- Rollback procedure documented
- Testing:
- Unit tests for feature flag wrapping
- Integration tests verifying flag behavior
- Default value tests (false)
- Metrics comparison test
- Rollback procedure test
- Estimated Complexity: Low
- Dependencies: Engine Integration in OCR Pipeline
- Priority: P2 (After Registry-Driven Prompts & Schema)
Epic: Advanced Preprocessing & Confidence Calibration
Feature: Modular Preprocessing Pipeline
Description: Implement modular preprocessing pipeline with configurable steps.
- Tasks:
- Design preprocessing step interface
- Create preprocessing service in backend/services/ocr_preprocessing.py
- Implement standard steps: deskew, CLAHE, denoise, background normalization, binarization
- Add step chaining and configuration
- Implement step caching and reuse
- Subtasks:
- Define preprocessing step interface
- Create PreprocessingService class
- Implement deskew step (Hough lines or projection profile)
- Implement CLAHE step (contrast adaptive histogram equalization)
- Implement denoise step (median blur or non-local means)
- Implement background normalization step (retinex or homomorphic filtering)
- Implement binarization step (Sauvola, Otsu, or adaptive threshold)
- Add step chaining and pipeline execution
- Add preprocessing configuration (enabled steps, order, parameters)
- Implement preprocessing caching (LRU or TTL-based)
- Add step metrics (latency, success rate)
- Acceptance Criteria:
- Preprocessing step interface defined
- All five standard steps implemented
- Step chaining and pipeline execution functional
- Preprocessing configuration supported (enabled steps, order)
- Preprocessing caching improves performance
- Step metrics collected (latency, success rate)
- Testing:
- Unit tests for preprocessing service (>90% coverage)
- Integration tests verifying each step functionality
- Integration tests verifying step chaining and pipeline
- Configuration test for step enabling/disabling and ordering
- Caching test verifying performance improvement
- Step metrics test confirming collection and reporting
- Estimated Complexity: Medium
- Dependencies: Pluggable OCR Engine Layer
- Priority: P3 (After Pluggable OCR Engine Layer)
Feature: Preprocessing Profiles in Registry
Description: Extend document registry to store engine-specific preprocessing profiles.
- Tasks:
- Extend DocumentTypeConfig to include preprocessing_profile field
- Add validation for preprocessing profile references
- Create default preprocessing profiles for each engine
- Map document types to appropriate preprocessing profiles
- Subtasks:
- Extend DocumentTypeConfig with preprocessing_profile field
- Add validation for preprocessing profile references
- Create default Tesseract preprocessing profile
- Create default Donut preprocessing profile
- Create default Azure Read preprocessing profile
- Map existing document types to profiles
- Add validation for profile references in registry
- Implement profile lookup and retrieval
- Acceptance Criteria:
- DocumentTypeConfig includes preprocessing_profile field
- Validation ensures preprocessing profile references exist
- Default profiles created for each engine
- Existing document types mapped to profiles
- Profile validation prevents invalid references
- Profile lookup and retrieval functional
- Testing:
- Unit tests for DocumentTypeConfig extension (>90% coverage)
- Integration tests verifying profile validation
- Default profiles test for each engine
- Mapping test verifying correct document type assignment
- Validation test for profile references
- Profile lookup test
- Estimated Complexity: Low
- Dependencies: Modular Preprocessing Pipeline
- Priority: P3 (After Pluggable OCR Engine Layer)
Feature: Confidence Calibration Implementation
Description: Implement per-token confidence calibration using Platt scaling or isotonic regression.
- Tasks:
- Design confidence calibration data model
- Implement confidence calibration service in backend/services/confidence_calibration.py
- Add Platt scaling and isotonic regression implementations
- Implement calibration data collection and updating
- Add calibration application to OCR tokens
- Subtasks:
- Define ConfidenceCalibration data model
- Create ConfidenceCalibrationService class
- Implement Platt scaling method
- Implement isotonic regression method
- Add calibration data collection from OCR results
- Implement calibration updating procedure
- Add calibration application to OCR tokens/words
- Add calibration metrics (Brier score, log loss, reliability diagram)
- Create default calibration per engine
- Acceptance Criteria:
- Confidence calibration service implemented
- Platt scaling and isotonic regression implemented
- Calibration data collection and updating functional
- Calibration application to OCR tokens/words working
- Calibration metrics collected (Brier score, log loss, reliability)
- Default calibration created for each engine
- Testing:
- Unit tests for confidence calibration service (>90% coverage)
- Integration tests verifying Platt scaling and isotonic regression
- Integration tests verifying data collection and updating
- Integration tests verifying calibration application
- Calibration metrics test confirming collection
- Default calibration test for each engine
- Estimated Complexity: Medium
- Dependencies: Pluggable OCR Engine Layer
- Priority: P3 (After Pluggable OCR Engine Layer)
Feature: Language Model Rescorer Implementation
Description: Implement language model rescoring stage for low-confidence tokens to improve accuracy.
- Tasks:
- Design language model rescoring interface
- Implement LM rescoring service in backend/services/lm_rescorer.py
- Add confidence-based triggering (only rescore tokens below threshold)
- Implement token batching for efficient processing
- Add fallback to original tokens on rescoring failure
- Subtasks:
- Define LMRescorer interface
- Create LMRescorerService class
- Implement confidence-based triggering (rescore if token confidence < 0.6)
- Add token batching (process tokens in batches for efficiency)
- Implement language model loading and inference (small LM like DistilBERT)
- Add rescoring logic (replace token if LM suggests higher probability alternative)
- Implement fallback to original tokens on failure
- Add rescoring metrics (tokens rescored, accuracy improvement)
- Create default configuration (threshold, model, batch size)
- Acceptance Criteria:
- LM rescoring service implemented with confidence-based triggering
- Only tokens below confidence threshold (default 0.6) are rescored
- Token batching improves processing efficiency
- Language model loading and inference functional
- Rescoring logic replaces tokens with higher probability alternatives
- Fallback to original tokens on rescoring failure
- Rescoring metrics collected (tokens processed, accuracy impact)
- Default configuration functional
- Testing:
- Unit tests for LM rescoring service (>90% coverage)
- Integration tests verifying confidence-based triggering
- Integration tests verifying token batching efficiency
- Integration tests verifying language model inference
- Integration tests verifying rescoring logic and fallback
- Metrics test confirming collection and reporting
- Accuracy test showing improvement on low-confidence tokens
- Estimated Complexity: Medium
- Dependencies: Pluggable OCR Engine Layer, Confidence Calibration Implementation
- Priority: P3 (After Pluggable OCR Engine Layer)
Feature: Preprocessing, Calibration, and Rescorer Integration
Description: Integrate preprocessing, confidence calibration, and language model rescoring into OCR pipeline.
- Tasks:
- Update backend/services/ocr_document_pipeline.py to include new stages
- Add preprocessing stage before OCR execution
- Add confidence calibration stage after OCR execution
- Add language model rescoring stage after calibration
- Handle stage failures and fallbacks
- Add metrics for each stage utilization and performance
- Subtasks:
- Update OCR pipeline to call preprocessing service
- Update OCR pipeline to call confidence calibration service
- Update OCR pipeline to call LM rescorer service
- Add error handling for each stage
- Implement fallback to skipping stage on failure
- Add metrics for stage latency and success rate
- Update any other pipeline entry points
- Acceptance Criteria:
- OCR pipeline executes preprocessing before OCR
- OCR pipeline executes confidence calibration after OCR
- OCR pipeline executes LM rescoring after calibration
- Stage failures handled gracefully with fallback to skipping
- Metrics collected for each stage utilization and performance
- No disruption to existing pipeline functionality
- Testing:
- Unit tests for pipeline modifications
- Integration tests verifying stage execution order
- Integration tests verifying stage failure handling
- Fallback test verifying graceful degradation
- Metrics test confirming stage utilization collection
- Regression test ensuring existing functionality intact
- Estimated Complexity: Medium
- Dependencies: Modular Preprocessing Pipeline, Preprocessing Profiles in Registry, Confidence Calibration Implementation, Language Model Rescorer Implementation
- Priority: P3 (After Pluggable OCR Engine Layer)


Feature: Preprocessing, Calibration, and Rescorer Feature Flags (continued)
Description: Implement feature flags for safe rollout of preprocessing, calibration, and rescoring stages.
- Tasks:
- Add feature flag OCR_USE_ADVANCED_PREPROCESS to configuration
- Add feature flag OCR_USE_CONFIDENCE_CALIBRATION to configuration
- Add feature flag OCR_USE_LM_RESCORER to configuration
- Wrap each stage call with flag check
- Implement legacy fallback when flags disabled
- Create metrics to compare legacy vs new pipeline
- Set defaults to false for safe rollout
- Subtasks:
- Add feature flags to configuration system
- Wrap preprocessing service call with flag check
- Wrap confidence calibration service call with flag check
- Wrap LM rescorer service call with flag check
- Implement legacy fallback (skip stages)
- Add metrics comparison (legacy vs new pipeline)
- Set default values to false
- Create rollback procedure documentation
- Acceptance Criteria:
- Feature flag OCR_USE_ADVANCED_PREPROCESS controls preprocessing usage
- Feature flag OCR_USE_CONFIDENCE_CALIBRATION controls calibration usage
- Feature flag OCR_USE_LM_RESCORER controls rescoring usage
- When false, skips respective stage (legacy behavior)
- When true, executes respective stage as implemented
- Metrics comparison shows performance impact of each stage
- Default values are false for safe initial rollout
- Rollback procedure documented and tested
- Testing:
- Unit tests for feature flag wrapping (>90% coverage)
- Integration tests verifying flag behavior (on/off)
- Default value test (false)
- Metrics comparison test verifying collection and reporting
- Rollback procedure test verifying graceful degradation
- Regression test ensuring existing functionality intact when flags disabled
- Estimated Complexity: Low
- Dependencies: Modular Preprocessing Pipeline, Preprocessing Profiles in Registry, Confidence Calibration Implementation, Language Model Rescorer Implementation
- Priority: P3 (After Pluggable OCR Engine Layer)
Epic: Validation Pipeline & Response Schema
Feature: Validation Pipeline Implementation
Description: Build multi-stage validation pipeline (structural, schema, business, semantic) with configurable rules.
- Tasks:
- Design validation stage interfaces
- Implement validation pipeline in backend/services/validation_pipeline.py
- Add structural validation stage (row/column consistency, empty cell ratio, alignment)
- Add schema validation stage (JSON schema validation)
- Add business rule validation stage (value ranges, cross-field checks, format validations)
- Add semantic validation stage (anomaly detection, trend analysis, fraud indicators)
- Implement pipeline orchestration with error handling and metrics
- Subtasks:
- Define validation stage interfaces
- Create ValidationPipeline class
- Implement structural validation stage
- Implement schema validation stage (using ajv or similar)
- Implement business rule validation stage
- Implement semantic validation stage
- Add pipeline orchestration logic (stage execution, error propagation)
- Add pipeline metrics (latency per stage, pass/fail rates)
- Create default validation rules for existing document types
- Add validation caching for performance
- Acceptance Criteria:
- Validation pipeline executes stages in order
- Structural validation checks basic OCR integrity
- Schema validation validates against document-type-specific JSON schema
- Business rule validation applies value ranges and cross-field checks
- Semantic validation applies AI/ML-enhanced checks
- Pipeline metrics collected (latency, pass/fail rates)
- Default validation rules created for existing types
- Validation caching improves performance
- Testing:
- Unit tests for validation pipeline (>90% coverage per stage)
- Integration tests verifying stage execution order
- Integration tests verifying each validation stage functionality
- Pipeline metrics test
- Default validation rules test
- Validation caching test
- Estimated Complexity: Medium
- Dependencies: Advanced Preprocessing & Confidence Calibration
- Priority: P4 (After Advanced Preprocessing & Confidence Calibration)
Feature: Enriched OCR Response Schema
Description: Define and implement enriched OCR response schema with metadata, confidence scores, validation results, and structural elements.
- Tasks:
- Design OCR result data model (Pydantic)
- Implement OCR result model in backend/models/ocr_result.py
- Add fields for document info, processing metadata, confidence scores, content blocks, layout analysis, validation, warnings, and export readiness
- Implement serialization/deserialization methods
- Add validation for required fields and constraints
- Subtasks:
- Define OCRResult Pydantic model
- Add document_info field (type, subtype, confidence, variant)
- Add processing_metadata field (engine, version, latency, cost, profile, timestamp, request_id)
- Add confidence_scores field (overall, factual, structural, per_block)
- Add content field with blocks structure (headers, line_items, totals, etc.)
- Add layout_analysis field (detected_type, columns, grouping, rotation, deskew)
- Add validation field (passed, errors, warnings, value_range_violations, cross_field_violations)
- Add warnings field (general processing warnings)
- Add export_ready, review_required, trusted_export fields
- Implement to_dict/from_dict methods
- Add model validation (required fields, constraints)
- Create default OCR result factory
- Acceptance Criteria:
- OCRResult model defined with all required fields
- Document info captures type and confidence
- Processing metadata includes engine, version, latency, cost
- Confidence scores include overall, factual, structural, and per-block
- Content field supports structured blocks (headers, items, totals)
- Layout analysis captures structural information
- Validation field captures pass/fail status and field-specific errors
- Warning fields capture general processing warnings
- Export readiness and review flags functional
- Model validation enforces required fields and constraints
- Serialization/deserialization works correctly
- Testing:
- Unit tests for OCRResult model (>90% coverage)
- Integration tests verifying field population from pipeline
- Serialization test verifying round-trip integrity
- Validation test for required fields and constraints
- Default factory test
- Estimated Complexity: Medium
- Dependencies: Validation Pipeline Implementation
- Priority: P4 (After Advanced Preprocessing & Confidence Calibration)
Feature: Response Building Integration
Description: Update OCR pipeline to build and return enriched OCR response format.
- Tasks:
- Update backend/services/ocr_document_pipeline.py to use enriched schema
- Map pipeline outputs to OCRResult fields
- Integrate validation pipeline results into response
- Handle response building errors and fallbacks
- Add metrics for response building performance
- Subtasks:
- Update OCR pipeline to instantiate OCRResult
- Map document classification results to document_info
- Map processing metadata (engine, latency, cost) to processing_metadata
- Map confidence scores to confidence_scores field
- Map OCR content (blocks, items) to content field
- Map layout analysis results to layout_analysis field
- Map validation pipeline results to validation field
- Map general warnings to warnings field
- Set export_ready, review_required, trusted_export flags
- Add error handling for response building failures
- Implement fallback to legacy flat response on failure
- Add metrics for response building latency and success rate
- Acceptance Criteria:
- OCR pipeline returns enriched OCRResult instance
- Document info populated from classification results
- Processing metadata includes engine, version, latency, cost
- Confidence scores reflect overall, factual, structural, per-block
- Content field contains structured blocks with field-level data
- Layout analysis populated with structural information
- Validation results integrated from validation pipeline
- General warnings captured
- Export readiness and review flags set correctly
- Response building errors handled with fallback to legacy format
- Metrics collected for response building performance
- Testing:
- Unit tests for response building integration
- Integration tests verifying enriched response generation
- Integration tests verifying field mapping accuracy
- Error handling test for response building failures
- Fallback test to legacy flat response
- Metrics test confirming performance collection
- Regression test ensuring existing pipeline functionality intact
- Estimated Complexity: Medium
- Dependencies: Validation Pipeline Implementation, Enriched OCR Response Schema
- Priority: P4 (After Advanced Preprocessing & Confidence Calibration)
Feature: Validation Service Feature Flags
Description: Implement feature flags for safe rollout of validation pipeline and enriched response.
- Tasks:
- Add feature flag OCR_USE_ENRICHED_RESPONSE to configuration
- Wrap validation pipeline call with flag check
- Wrap enriched response building with flag check
- Implement legacy fallback when flag disabled (flat response)
- Create metrics to compare legacy vs new response
- Set default to false for safe rollout
- Subtasks:
- Add feature flag to configuration system
- Wrap validation pipeline call in OCR pipeline with flag check
- Wrap enriched response building with flag check
- Implement legacy fallback (skip validation, return flat response)
- Add metrics comparison (legacy vs new response)
- Set default value to false
- Create rollback procedure documentation
- Acceptance Criteria:
- Feature flag OCR_USE_ENRICHED_RESPONSE controls usage
- When false, uses legacy validation and flat response
- When true, uses validation pipeline and enriched response
- Metrics compare legacy vs new response (size, latency, client compatibility)
- Default value is false for safe initial rollout
- Rollback procedure documented and tested
- Testing:
- Unit tests for feature flag wrapping (>90% coverage)
- Integration tests verifying flag behavior (on/off)
- Default value test (false)
- Metrics comparison test verifying collection and reporting
- Rollback procedure test verifying graceful degradation
- Regression test ensuring existing functionality intact when flag disabled
- Estimated Complexity: Low
- Dependencies: Validation Pipeline Implementation, Enriched OCR Response Schema, Response Building Integration
- Priority: P4 (After Advanced Preprocessing & Confidence Calibration)
Epic: Frontend Adaptive Layout & Review UX
Feature: Frontend Layout Strategy Implementation
Description: Implement frontend layout strategy logic based on data density and document type.
- Tasks:
- Create layout strategy service in frontend/src/lib/layout-strategy.ts
- Add data density calculation (rows × columns, field count)
- Implement layout mode selection logic (compact/summary/paginated/card)
- Add document type-specific overrides
- Implement caching for strategy results
- Subtasks:
- Create LayoutStrategy class
- Implement data density calculation from OCR result
- Add layout mode selection based on density thresholds
- Add document type-specific layout preferences
- Implement layout strategy caching (LRU or TTL-based)
- Add metrics for strategy latency and cache hit rate
- Create default layout strategy configuration
- Add validation for layout mode selection
- Acceptance Criteria:
- Layout strategy calculates data density correctly
- Layout mode selection based on density thresholds
- Document type-specific overrides functional
- Layout strategy caching improves performance
- Metrics collected for latency and cache hit rate
- Default configuration functional
- Validation prevents invalid layout mode selection
- Testing:
- Unit tests for layout strategy (>90% coverage)
- Integration tests verifying data density calculation
- Integration tests verifying layout mode selection
- Integration tests verifying document type overrides
- Caching test verifying performance improvement
- Metrics test confirming collection and reporting
- Validation test for layout mode selection
- Estimated Complexity: Medium
- Dependencies: Validation Pipeline & Response Schema
- Priority: P5 (After Validation Pipeline & Response Schema)
Feature: Adaptive Table View Component
Description: Create adaptive table view component handling compact/summary/paginated layout modes.
- Tasks:
- Create component in frontend/src/views/adaptive-table-view.tsx
- Implement compact mode (simple editable table)
- Implement summary mode (collapsible sections with summary rows)
- Implement paginated mode (virtual scrolling with header statistics)
- Add loading states and error handling
- Integrate with layout strategy for mode selection
- Subtasks:
- Create AdaptiveTableView component
- Implement compact table mode (editable headers/rows)
- Implement summary table mode (collapsible sections, summary rows)
- Implement paginated table mode (virtual scrolling, header stats)
- Add loading and error states
- Integrate with layout strategy for mode selection
- Add keyboard navigation support
- Add accessibility features (ARIA labels, roles)
- Create default props configuration
- Acceptance Criteria:
- Component renders correctly in compact mode (< 50 cells)
- Component renders correctly in summary mode (50-200 cells)
- Component renders correctly in paginated mode (> 200 cells)
- Loading and error states functional
- Layout strategy integration selects correct mode
- Keyboard navigation works in all modes
- Accessibility features implemented (ARIA, roles)
- Default props configuration functional
- Testing:
- Unit tests for AdaptiveTableView (>80% coverage)
- Integration tests verifying each layout mode
- Integration tests verifying loading and error states
- Integration tests verifying layout strategy integration
- Accessibility test (axe-core) for each mode
- Keyboard navigation test
- Default props test
- Estimated Complexity: Medium
- Dependencies: Frontend Layout Strategy Implementation
- Priority: P5 (After Validation Pipeline & Response Schema)
Feature: Card Form View Component
Description: Create card-style view component for low-density forms.
- Tasks:
- Create component in frontend/src/views/card-form-view.tsx
- Implement form-style layout with field grouping
- Add field-level editing with validation
- Implement section-based organization for complex forms
- Add loading states and error handling
- Subtasks:
- Create CardFormView component
- Implement form-style layout (label-value pairs)
- Add field-level editing with inline validation
- Implement section-based organization (collapsible field groups)
- Add loading and error states
- Integrate with layout strategy for mode selection
- Add keyboard navigation support
- Add accessibility features (ARIA labels, roles)
- Create default props configuration
- Acceptance Criteria:
- Component renders correctly for low-density forms (< 10 fields, no repeating sections)
- Field-level editing with validation functional
- Section-based organization works for complex forms
- Loading and error states functional
- Layout strategy integration selects card mode when appropriate
- Keyboard navigation works
- Accessibility features implemented (ARIA, roles)
- Default props configuration functional
- Testing:
- Unit tests for CardFormView (>80% coverage)
- Integration tests verifying form rendering and editing
- Integration tests verifying section-based organization
- Integration tests verifying loading and error states
- Integration tests verifying layout strategy integration
- Accessibility test (axe-core)
- Keyboard navigation test
- Default props test
- Estimated Complexity: Medium
- Dependencies: Frontend Layout Strategy Implementation
- Priority: P5 (After Validation Pipeline & Response Schema)
Feature: Sectioned View Component
Description: Create sectioned view component for documents with logical groupings.
- Tasks:
- Create component in frontend/src/views/sectioned-view.tsx
- Implement collapsible sections with titles
- Add section-specific layouts (table, form, key-value)
- Implement section expansion/collapsing state
- Add loading states and error handling
- Subtasks:
- Create SectionedView component
- Implement collapsible section UI
- Add section-specific layout rendering
- Implement expansion/collapsing state management
- Add loading and error states
- Integrate with layout strategy for mode selection
- Add keyboard navigation support
- Add accessibility features (ARIA labels, roles)
- Create default props configuration
- Acceptance Criteria:
- Component renders collapsible sections correctly
- Section-specific layouts functional (table, form, key-value)
- Expansion/collapsing state management works
- Loading and error states functional
- Layout strategy integration selects sectioned mode when appropriate
- Keyboard navigation works
- Accessibility features implemented (ARIA, roles)
- Default props configuration functional
- Testing:
- Unit tests for SectionedView (>80% coverage)
- Integration tests verifying section rendering
- Integration tests verifying section-specific layouts
- Integration tests verifying expansion/collapsing
- Integration tests verifying loading and error states
- Integration tests verifying layout strategy integration
- Accessibility test (axe-core)
- Keyboard navigation test
- Default props test
- Estimated Complexity: Medium
- Dependencies: Frontend Layout Strategy Implementation
- Priority: P5 (After Validation Pipeline & Response Schema)
Feature: Paginated Table View Component
Description: Create paginated table view component with virtual scrolling for large documents.
- Tasks:
- Create component in frontend/src/views/paginated-table-view.tsx
- Implement virtual scrolling for large row sets
- Add header statistics (sum, avg, count) for numeric columns
- Implement column freezing and sorting
- Add loading skeletons and error handling
- Implement row selection and batch operations
- Subtasks:
- Create PaginatedTableView component
- Implement virtual scrolling (windowed rendering)
- Add header statistics calculation and display
- Implement column freezing (left columns fixed)
- Implement column sorting (click to sort)
- Add loading skeletons and error handling
- Implement row selection and batch operations (delete, update)
- Integrate with layout strategy for mode selection
- Add keyboard navigation support
- Add accessibility features (ARIA labels, roles)
- Create default props configuration
- Acceptance Criteria:
- Component renders large tables (> 200 cells) with virtual scrolling
- Header statistics displayed and updated correctly
- Column freezing and sorting functional
- Loading skeletons and error handling implemented
- Row selection and batch operations work
- Layout strategy integration selects paginated mode when appropriate
- Keyboard navigation works
- Accessibility features implemented (ARIA, roles)
- Default props configuration functional
- Testing:
- Unit tests for PaginatedTableView (>80% coverage)
- Integration tests verifying virtual scrolling performance
- Integration tests verifying header statistics
- Integration tests verifying column freezing and sorting
- Integration tests verifying loading skeletons and error handling
- Integration tests verifying row selection and batch operations
- Integration tests verifying layout strategy integration
- Accessibility test (axe-core)
- Keyboard navigation test
- Default props test
- Estimated Complexity: Medium
- Dependencies: Frontend Layout Strategy Implementation
- Priority: P5 (After Validation Pipeline & Response Schema)
Feature: Confidence Display Components
Description: Create components for visualizing field-level confidence scores.
- Tasks:
- Create confidence badge component in frontend/src/components/confidence-badge.tsx
- Create confidence display component in frontend/src/lib/confidence-display.tsx
- Implement color coding (green ≥0.85, yellow 0.60-0.85, red <0.60)
- Add hover tooltips with exact scores and field information
- Add optional "show low confidence fields" filter
- Subtasks:
- Create ConfidenceBadge component
- Implement color coding based on score thresholds
- Add hover tooltip with exact score and field info
- Create ConfidenceDisplay component
- Integrate confidence visualization into table/form views
- Add "show low confidence fields" filter functionality
- Add metrics for confidence display usage
- Create default configuration for thresholds and styling
- Acceptance Criteria:
- ConfidenceBadge displays correct color based on score
- Hover tooltip shows exact score and field information
- ConfidenceDisplay integrates confidence visualization into views
- "Show low confidence fields" filter works correctly
- Metrics collected for usage
- Default configuration functional
- Testing:
- Unit tests for confidence components (>90% coverage)
- Integration tests verifying color coding and tooltips
- Integration tests verifying integration into table/form views
- Integration tests verifying low confidence filter
- Metrics test confirming collection and reporting
- Default configuration test
- Estimated Complexity: Low
- Dependencies: Frontend Layout Strategy Implementation
- Priority: P5 (After Validation Pipeline & Response Schema)
Feature: Review Workflow Enhancements
Description: Enhance review workflow with smart navigation, correction suggestions, and change tracking.
- Tasks:
- Update review workflow in frontend/src/lib/review-workflow.ts
- Add smart navigation (jump to next low-confidence field)
- Add AI-powered correction suggestions for uncertain fields
- Implement change tracking with audit trail and undo/redo
- Add review progress indicator
- Subtasks:
- Update review-workflow.ts with smart navigation logic
- Add jump-to-next-low-confidence functionality
- Add AI-powered correction suggestion generation for uncertain fields
- Implement change tracking (audit trail, undo/redo stack)
- Add review progress indicator (percentage completed)
- Add keyboard shortcuts for navigation and suggestions
- Add metrics for review workflow usage
- Create default configuration for navigation and suggestions
- Acceptance Criteria:
- Smart navigation jumps to next field with confidence < 0.6
- AI-powered suggestions displayed for fields with confidence 0.6-0.85
- Change tracking records modifications with user/timestamp
- Undo/redo functionality works correctly
- Review progress indicator updates correctly
- Keyboard shortcuts functional for navigation and suggestions
- Metrics collected for review workflow usage
- Default configuration functional
- Testing:
- Unit tests for review workflow enhancements (>90% coverage)
- Integration tests verifying smart navigation
- Integration tests verifying correction suggestions
- Integration tests verifying change tracking and undo/redo
- Integration tests verifying progress indicator
- Keyboard shortcuts test
- Metrics test confirming collection and reporting
- Default configuration test
- Estimated Complexity: Medium
- Dependencies: Validation Pipeline & Response Schema
- Priority: P5 (After Validation Pipeline & Response Schema)
Feature: Export Manager Implementation
Description: Create component for managing export options and preview.
- Tasks:
- Create export manager in frontend/src/lib/export-manager.ts
- Add support for multiple formats (Excel, PDF, JSON, XML, CSV)
- Implement export preview functionality
- Add format-specific options (sheet names, formatting, etc.)
- Implement download and direct API export options
- Subtasks:
- Create ExportManager class
- Add support for Excel export with formatting
- Add support for PDF export with image overlay
- Add support for JSON/XML export
- Add support for CSV export
- Implement export preview (dialog with format selection)
- Add format-specific options (Excel sheets, PDF layout, etc.)
- Implement download and direct API export options
- Add error handling for export failures
- Add metrics for export usage and performance
- Create default export configuration
- Acceptance Criteria:
- Export manager supports all required formats
- Export preview shows format selection and options
- Format-specific options functional (Excel sheets, PDF layout)
- Download and direct API export options work
- Export failures handled gracefully with error messages
- Metrics collected for export usage and performance
- Default export configuration functional
- Testing:
- Unit tests for export manager (>90% coverage)
- Integration tests verifying each export format
- Integration tests verifying export preview functionality
- Integration tests verifying format-specific options
- Integration tests verifying download and API export
- Integration tests verifying error handling
- Metrics test confirming collection and reporting
- Default configuration test
- Estimated Complexity: Medium
- Dependencies: Validation Pipeline & Response Schema
- Priority: P5 (After Validation Pipeline & Response Schema)
Feature: Frontend Accessibility and Responsiveness
Description: Implement accessibility compliance (WCAG 2.1 AA) and responsive design for tablet/desktop use.
- Tasks:
- Create accessibility utilities in frontend/src/lib/accessibility-utils.ts
- Create responsive design utilities in frontend/src/lib/responsive-design.ts
- Update all frontend components for accessibility and responsiveness
- Add ARIA labels, roles, and keyboard navigation
- Implement responsive breakpoints and adaptations
- Subtasks:
- Create accessibility utilities (focus management, ARIA, color contrast)
- Create responsive design utilities (breakpoints, adaptations)
- Update AdaptiveTableView for accessibility and responsiveness
- Update CardFormView for accessibility and responsiveness
- Update SectionedView for accessibility and responsiveness
- Update PaginatedTableView for accessibility and responsiveness
- Update confidence display components for accessibility
- Update review workflow for accessibility
- Update export manager for accessibility
- Add keyboard navigation to all interactive components
- Implement responsive layout adaptations
- Acceptance Criteria:
- All frontend components accessible (WCAG 2.1 AA)
- Keyboard navigation works throughout the interface
- ARIA labels and roles correctly applied
- Color contrast meets WCAG 2.1 AA standards
- Responsive design adapts to mobile/tablet breakpoints
- Layout and functionality preserved across device sizes
- No accessibility violations in automated testing
- Testing:
- Unit tests for accessibility and responsive utilities
- Integration tests verifying accessibility of all components
- Integration tests verifying responsive design adaptations
- Automated accessibility testing (axe-core, Lighthouse)
- Manual accessibility testing with screen readers
- Responsive design testing across device breakpoints
- Estimated Complexity: Medium
- Dependencies: Validation Pipeline & Response Schema
- Priority: P5 (After Validation Pipeline & Response Schema)
Feature: Frontend Feature Flags
Description: Implement feature flags for safe rollout of frontend adaptive layout and review enhancements.
- Tasks:
- Add feature flags for each layout mode and enhancement
- Wrap frontend component usage with flag checks
- Implement legacy fallback when flags disabled
- Create metrics to compare legacy vs new frontend
- Set defaults to false for safe rollout
- Subtasks:
- Add feature flag OCR_USE_CARD_VIEW to configuration
- Add feature flag OCR_USE_COMPACT_TABLE to configuration
- Add feature flag OCR_USE_SECTIONED_TABLE to configuration
- Add feature flag OCR_USE_PAGINATED_TABLE to configuration
- Add feature flag OCR_USE_CONFIDENCE_DISPLAY to configuration
- Add feature flag OCR_USE_REVIEW_WORKFLOW_ENHANCE to configuration
- Add feature flag OCR_USE_EXPORT_MANAGER to configuration
- Add feature flag OCR_USE_ACCESSIBILITY_RESPONSIVE to configuration
- Wrap component usage with flag checks
- Implement legacy fallback (generic table view)
- Add metrics comparison (legacy vs new frontend)
- Set default values to false
- Create rollback procedure documentation
- Acceptance Criteria:
- Each feature flag controls its respective frontend enhancement
- When false, uses legacy generic table view
- When true, uses respective enhancement
- Metrics compare legacy vs new frontend (usage, performance, satisfaction)
- Default values are false for safe initial rollout
- Rollback procedure documented and tested
- Testing:
- Unit tests for feature flag wrapping (>90% coverage)
- Integration tests verifying flag behavior (on/off)
- Default value tests (false)
- Metrics comparison test verifying collection and reporting
- Rollback procedure test verifying graceful degradation
- Regression test ensuring existing frontend intact when flags disabled
- Estimated Complexity: Low
- Dependencies: All frontend adaptive layout and review enhancements
- Priority: P5 (After Validation Pipeline & Response Schema)
Epic: Scalability & Observability Enhancements
Feature: Worker Pools Implementation
Description: Implement specialized worker pools (CPU-intensive and GPU-intensive) for different processing stages.
- Tasks:
- Create worker pools service in backend/services/worker-pools.py
- Implement CPU-intensive worker pool (pre-flight, validation, Tesseract)
- Implement GPU-intensive worker pool (Donut, TrOCR, vision models)
- Add worker registration, job queuing, and result collection
- Implement worker health monitoring and auto-restart
- Subtasks:
- Create WorkerPoolsService class
- Implement CPU worker pool with job queuing
- Implement GPU worker pool with job queuing
- Add worker registration and deregistration
- Implement job queuing and result collection
- Add worker health monitoring (heartbeat, resource usage)
- Add auto-restart for failed workers
- Add metrics for worker utilization and job latency
- Create default worker pool configuration
- Add configuration for worker counts and job timeouts
- Acceptance Criteria:
- Worker pools service manages CPU and GPU worker pools
- CPU worker pool handles pre-flight, validation, Tesseract OCR
- GPU worker pool handles Donut, TrOCR, vision model inference
- Worker registration and deregistration functional
- Job queuing and result collection work correctly
- Worker health monitoring and auto-restart functional
- Metrics collected for utilization and job latency
- Default configuration functional
- Testing:
- Unit tests for worker pools service (>90% coverage)
- Integration tests verifying CPU and GPU worker pool separation
- Integration tests verifying job queuing and result collection
- Integration tests verifying worker health monitoring
- Integration tests verifying auto-restart functionality
- Metrics test confirming collection and reporting
- Default configuration test
- Estimated Complexity: Medium
- Dependencies: Frontend Adaptive Layout & Review UX
- Priority: P6 (After Frontend Adaptive Layout & Review UX)
Feature: Message Queue Implementation
Description: Implement message queuing system for asynchronous processing and load leveling.
- Tasks:
- Create message queue service in backend/services/message-queue.py
- Implement message producer and consumer interfaces
- Add message persistence and acknowledgment
- Implement dead letter queue for failed messages
- Add message routing and topic support
- Subtasks:
- Create MessageQueueService class
- Implement producer interface (send message)
- Implement consumer interface (receive message)
- Add message persistence (disk or database)
- Implement acknowledgment mechanism
- Add dead letter queue for failed messages
- Add message routing and topic support
- Add metrics for queue depth, message latency, throughput
- Create default message queue configuration
- Add configuration for persistence, acknowledgment, DLQ
- Acceptance Criteria:
- Message queue service implements producer/consumer interfaces
- Message persistence ensures durability
- Acknowledgment mechanism prevents message loss
- Dead letter queue captures failed messages
- Message routing and topic support functional
- Metrics collected for queue depth, latency, throughput
- Default configuration functional
- Testing:
- Unit tests for message queue service (>90% coverage)
- Integration tests verifying producer/consumer interface
- Integration tests verifying message persistence
- Integration tests verifying acknowledgment mechanism
- Integration tests verifying dead letter queue
- Integration tests verifying routing and topic support
- Metrics test confirming collection and reporting
- Default configuration test
- Estimated Complexity: Medium
- Dependencies: Worker Pools Implementation
- Priority: P6 (After Frontend Adaptive Layout & Review UX)
Feature: Redis Cache Implementation
Description: Implement Redis caching layer for OCR results to reduce redundant processing.
- Tasks:
- Create Redis cache service in backend/services/redis-cache.py
- Implement cache key generation (document hash + parameters)
- Add get/set/delete operations with TTL support
- Implement cache warming and invalidation strategies
- Add cache metrics (hit rate, miss rate, latency)
- Subtasks:
- Create RedisCacheService class
- Implement cache key generation (SHA-256 of image + params)
- Add get/set/delete operations with TTL
- Implement cache warming (pre-load frequent documents)
- Add cache invalidation strategies (time-based, event-based)
- Add cache metrics (hit rate, miss rate, average latency)
- Create default Redis cache configuration
- Add configuration for TTL, warming, invalidation
- Acceptance Criteria:
- Redis cache service stores and retrieves OCR results
- Cache key generation uses document hash and parameters
- Get/set/delete operations work with TTL support
- Cache warming and invalidation strategies functional
- Cache metrics collected (hit rate, miss rate, latency)
- Default configuration functional
- Testing:
- Unit tests for Redis cache service (>90% coverage)
- Integration tests verifying cache storage and retrieval
- Integration tests verifying cache key generation
- Integration tests verifying get/set/delete with TTL
- Integration tests verifying cache warming and invalidation
- Metrics test confirming collection and reporting
- Default configuration test
- Estimated Complexity: Medium
- Dependencies: Message Queue Implementation
- Priority: P6 (After Frontend Adaptive Layout & Review UX)
Feature: Autoscaler Implementation
Description: Implement autoscaling policies based on queue depth, latency, and resource metrics.
- Tasks:
- Create autoscaler service in backend/services/autoscaler.py
- Add scaling triggers based on queue depth and latency
- Implement scaling policies with hysteresis and cooldown
- Add integration with worker pools and message queue
- Implement scaling metrics and logging
- Subtasks:
- Create AutoscalerService class
- Add scaling triggers (queue depth > threshold, latency > SLA)
- Implement scaling policies (hysteresis, cooldown periods)
- Add integration with worker pools (scale worker count)
- Add integration with message queue (scale consumer count)
- Add scaling metrics (scale events, resource utilization)
- Create default autoscaler configuration
- Add configuration for thresholds, hysteresis, cooldown
- Acceptance Criteria:
- Autoscaler service triggers scaling based on queue depth and latency
- Scaling policies include hysteresis and cooldown to prevent oscillation
- Integration with worker pools scales worker count correctly
- Integration with message queue scales consumer count correctly
- Scaling metrics collected (events, resource utilization)
- Default configuration functional
- Testing:
- Unit tests for autoscaler service (>90% coverage)
- Integration tests verifying scaling triggers
- Integration tests verifying scaling policies with hysteresis
- Integration tests verifying worker pool scaling
- Integration tests verifying message queue scaling
- Metrics test confirming collection and reporting
- Default configuration test
- Estimated Complexity: Medium
- Dependencies: Redis Cache Implementation
- Priority: P6 (After Frontend Adaptive Layout & Review UX)
Feature: Distributed Tracing Implementation
Description: Implement distributed tracing (OpenTelemetry/Jaeger) for end-to-end visibility.
- Tasks:
- Create tracing service in backend/services/tracing.py
- Implement trace ID propagation across service boundaries
- Add span creation for key processing stages
- Implement trace export to Jaeger or similar backend
- Add trace sampling and filtering
- Subtasks:
- Create TracingService class
- Implement trace ID propagation (headers or context)
- Add span creation for ingestion, classification, OCR, validation
- Implement trace export to Jaeger/OTEL collector
- Add trace sampling (probabilistic or rate-based)
- Add trace filtering (exclude sensitive data)
- Add metrics for trace generation and export latency
- Create default tracing configuration
- Add configuration for sampling rate, export endpoint
- Acceptance Criteria:
- Tracing service propagates trace IDs across service boundaries
- Spans created for key processing stages
- Trace export to Jaeger/OTEL collector functional
- Trace sampling and filtering implemented
- Metrics collected for trace generation and export latency
- Default configuration functional
- Testing:
- Unit tests for tracing service (>90% coverage)
- Integration tests verifying trace ID propagation
- Integration tests verifying span creation for stages
- Integration tests verifying trace export functionality
- Integration tests verifying trace sampling and filtering
- Metrics test confirming collection and reporting
- Default configuration test
- Estimated Complexity: Medium
- Dependencies: Autoscaler Implementation
- Priority: P6 (After Frontend Adaptive Layout & Review UX)
Feature: Health Checks and Load Balancing
Description: Enhance health checks and implement load balancing across worker pool instances.
- Tasks:
- Update health check service in backend/services/health-checks.py
- Add health checks for worker pools, message queue, Redis cache
- Implement load balancer service in backend/services/load-balancer.py
- Add round-robin or least-connections load balancing
- Add health check integration with load balancer
- Subtasks:
- Update health check service with worker pool checks
- Update health check service with message queue checks
- Update health check service with Redis cache checks
- Create LoadBalancerService class
- Implement round-robin load balancing
- Implement least-connections load balancing
- Add health check integration (remove unhealthy instances)
- Add metrics for request distribution and latency
- Create default load balancer configuration
- Add configuration for algorithm, health check interval
- Acceptance Criteria:
- Health checks cover worker pools, message queue, Redis cache
- Load balancer distributes requests across instances
- Load balancer integrates with health checks (removes unhealthy)
- Request distribution and latency metrics collected
- Default configuration functional
- Testing:
- Unit tests for health checks and load balancer (>90% coverage)
- Integration tests verifying health checks for all services
- Integration tests verifying load balancer distribution
- Integration tests verifying health check integration
- Metrics test confirming collection and reporting
- Default configuration test
- Estimated Complexity: Low
- Dependencies: Distributed Tracing Implementation
- Priority: P6 (After Frontend Adaptive Layout & Review UX)
Feature: Failure Detection and Failover
Description: Implement failure detection and automatic failover mechanisms for scaled services.
- Tasks:
- Create failure detector service in backend/services/failure-detector.py
- Add failure detection based on health checks and timeouts
- Implement automatic failover to healthy instances
- Add split-brain prevention and recovery mechanisms
- Implement failure metrics and logging
- Subtasks:
- Create FailureDetectorService class
- Add failure detection (health check failures, timeouts)
- Implement automatic failover to healthy instances
- Add split-brain prevention (quorum, consensus)
- Add recovery mechanisms (rehydration, state transfer)
- Add failure metrics (detection latency, failover time)
- Create default failure detector configuration
- Add configuration for detection thresholds, timeouts
- Acceptance Criteria:
- Failure detector service detects instance failures
- Automatic failover to healthy instances functional
- Split-brain prevention mechanisms implemented
- Recovery mechanisms work correctly
- Failure metrics collected (detection latency, failover time)
- Default configuration functional
- Testing:
- Unit tests for failure detector service (>90% coverage)
- Integration tests verifying failure detection
- Integration tests verifying automatic failover
- Integration tests verifying split-brain prevention
- Integration tests verifying recovery mechanisms
- Metrics test confirming collection and reporting
- Default configuration test
- Estimated Complexity: Medium
- Dependencies: Health Checks and Load Balancing
- Priority: P6 (After Frontend Adaptive Layout & Review UX)
Feature: Scalability Feature Flags
Description: Implement feature flags for safe rollout of scalability and observability enhancements.
- Tasks:
- Add feature flags for each scalability component
- Wrap service usage with flag checks
- Implement legacy fallback when flags disabled
- Create metrics to compare legacy vs new scalability
- Set defaults to false for safe rollout
- Subtasks:
- Add feature flag OCR_USE_WORKER_POOLS to configuration
- Add feature flag OCR_USE_MESSAGE_QUEUE to configuration
- Add feature flag OCR_USE_REDIS_CACHE to configuration
- Add feature flag OCR_USE_AUTOSCALER to configuration
- Add feature flag OCR_USE_TRACING to configuration
- Add feature flag OCR_USE_HEALTH_CHECKS to configuration
- Add feature flag OCR_USE_LOAD_BALANCER to configuration
- Add feature flag OCR_USE_FAILURE_DETECTOR to configuration
- Wrap service usage with flag checks
- Implement legacy fallback (monolithic, synchronous processing)
- Add metrics comparison (legacy vs new scalability)
- Set default values to false
- Create rollback procedure documentation
- Acceptance Criteria:
- Each feature flag controls its respective scalability component
- When false, uses legacy monolithic processing
- When true, uses respective scalability enhancement
- Metrics compare legacy vs new scalability (performance, resource usage, reliability)
- Default values are false for safe initial rollout
- Rollback procedure documented and tested
- Testing:
- Unit tests for feature flag wrapping (>90% coverage)
- Integration tests verifying flag behavior (on/off)
- Default value tests (false)
- Metrics comparison test verifying collection and reporting
- Rollback procedure test verifying graceful degradation
- Regression test ensuring existing functionality intact when flags disabled
- Estimated Complexity: Low
- Dependencies: All scalability and observability enhancements
- Priority: P6 (After Frontend Adaptive Layout & Review UX)
Epic: Security, Compliance & Cost Management
Feature: Encryption Implementation
Description: Implement encryption for data at rest (AES-256-GCM) and in transit (TLS 1.3).
- Tasks:
- Create encryption service in backend/services/encryption.py
- Implement AES-256-GCM encryption for data at rest
- Implement TLS 1.3 enforcement for external service communications
- Add key management integration
- Add encryption/decryption performance metrics
- Subtasks:
- Create EncryptionService class
- Implement AES-256-GCM encryption and decryption
- Enforce TLS 1.3 for all external HTTP requests
- Add key management service integration (Vault/KMS)
- Add encryption/decryption latency and throughput metrics
- Create default encryption configuration
- Add configuration for key management, algorithm
- Acceptance Criteria:
- Encryption service implements AES-256-GCM encryption/decryption
- All external service communications use TLS 1.3
- Key management service integration functional
- Encryption/decryption metrics collected (latency, throughput)
- Default configuration functional
- Testing:
- Unit tests for encryption service (>90% coverage)
- Integration tests verifying AES-256-GCM encryption/decryption
- Integration tests verifying TLS 1.3 enforcement
- Integration tests verifying key management integration
- Performance test verifying encryption/decryption overhead
- Default configuration test
- Estimated Complexity: Medium
- Dependencies: Scalability & Observability Enhancements
- Priority: P7 (After Scalability & Observability Enhancements)
Feature: Data Retention and Deletion Implementation
Description: Implement data retention policies and automated deletion workflows.
- Tasks:
- Create data retention service in backend/services/data-retention.py
- Add configurable retention periods per document type
- Implement automated deletion workflows with verification
- Add secure deletion with cryptographic erasure
- Add retention metrics and logging
- Subtasks:
- Create DataRetentionService class
- Add retention period configuration per document type
- Implement automated deletion workflows (scheduled jobs)
- Add secure deletion (cryptographic erasure, verified overwrite)
- Add retention metrics (deleted count, storage freed)
- Create default data retention configuration
- Add configuration for retention periods, deletion schedule
- Acceptance Criteria:
- Data retention service stores retention periods per type
- Automated deletion workflows trigger on schedule
- Secure deletion with verification implemented
- Retention metrics collected (deleted count, storage freed)
- Default configuration functional
- Testing:
- Unit tests for data retention service (>90% coverage)
- Integration tests verifying retention period configuration
- Integration tests verifying automated deletion workflows
- Integration tests verifying secure deletion with verification
- Metrics test confirming collection and reporting
- Default configuration test
- Estimated Complexity: Medium
- Dependencies: Encryption Implementation
- Priority: P7 (After Scalability & Observability Enhancements)
Feature: Access Control Implementation
Description: Implement fine-grained access controls (RBAC/ABAC) for data and operations.
- Tasks:
- Create access control service in backend/services/access-control.py
- Implement role-based access control (RBAC)
- Implement attribute-based access control (ABAC)
- Add policy decision point and policy enforcement point
- Add access control metrics and logging
- Subtasks:
- Create AccessControlService class
- Implement RBAC (roles, permissions, role assignment)
- Implement ABAC (attributes, policies, decision logic)
- Add policy decision point (evaluates access requests)
- Add policy enforcement point (enforces access decisions)
- Add access control metrics (grant/deny rates, latency)
- Create default access control configuration
- Add configuration for roles, attributes, policies
- Acceptance Criteria:
- Access control service implements RBAC and ABAC
- Policy decision point evaluates access requests correctly
- Policy enforcement point enforces access decisions
- Access control metrics collected (grant/deny rates, latency)
- Default configuration functional
- Testing:
- Unit tests for access control service (>90% coverage)
- Integration tests verifying RBAC and ABAC functionality
- Integration tests verifying policy decision and enforcement
- Metrics test confirming collection and reporting
- Default configuration test
- Estimated Complexity: Medium
- Dependencies: Data Retention and Deletion Implementation
- Priority: P7 (After Scalability & Observability Enhancements)
Feature: Cost Monitor Implementation
Description: Implement real-time cost monitoring and budget alerts.
- Tasks:
- Create cost monitor service in backend/services/cost-monitor.py
- Add cost collection from external service invocations
- Implement cost aggregation and reporting (daily, weekly, monthly)
- Add budget tracking and alerting with predictive forecasting
- Add cost optimization suggestions
- Subtasks:
- Create CostMonitorService class
- Add cost collection from OCR engine invocations
- Implement cost aggregation (total, per engine, per type)
- Add cost reporting (daily, weekly, monthly summaries)
- Add budget tracking and alerting (thresholds, forecasts)
- Add cost optimization suggestions (engine switching, preprocessing)
- Create default cost monitor configuration
- Add configuration for collection, reporting, budget thresholds
- Acceptance Criteria:
- Cost monitor service collects costs from external invocations
- Cost aggregation works (total, per engine, per document type)
- Cost reporting functions (daily, weekly, monthly)
- Budget tracking and alerting implemented (thresholds, forecasts)
- Cost optimization suggestions provided
- Default configuration functional
- Testing:
- Unit tests for cost monitor service (>90% coverage)
- Integration tests verifying cost collection from engines
- Integration tests verifying cost aggregation and reporting
- Integration tests verifying budget tracking and alerting
- Integration tests verifying cost optimization suggestions
- Metrics test confirming collection and reporting
- Default configuration test
- Estimated Complexity: Medium
- Dependencies: Access Control Implementation
- Priority: P7 (After Scalability & Observability Enhancements)
Feature: Compliance Implementation
Description: Implement GDPR/CCPA compliance features (data export, deletion, consent management).
- Tasks:
- Create compliance service in backend/services/compliance.py
- Add GDPR data export functionality (portable format)
- Add GDPR deletion functionality (right to be forgotten)
- Add consent management for data processing
- Add compliance reporting and audit trails
- Subtasks:
- Create ComplianceService class
- Add GDPR data export (structured JSON with all personal data)
- Add GDPR deletion (complete removal of personal data)
- Add consent management (tracking, withdrawal, logging)
- Add compliance reporting (export, deletion, consent logs)
- Create default compliance configuration
- Add configuration for export formats, deletion verification
- Acceptance Criteria:
- Compliance service implements GDPR data export
- Compliance service implements GDPR deletion
- Compliance service implements consent management
- Compliance reporting captures export, deletion, consent events
- Default configuration functional
- Testing:
- Unit tests for compliance service (>90% coverage)
- Integration tests verifying GDPR data export
- Integration tests verifying GDPR deletion
- Integration tests verifying consent management
- Metrics test confirming collection and reporting
- Default configuration test
- Estimated Complexity: Medium
- Dependencies: Cost Monitor Implementation
- Priority: P7 (After Scalability & Observability Enhancements)
Feature: Audit Logger Implementation
Description: Implement comprehensive, immutable audit logging.
- Tasks:
- Create audit logger service in backend/services/audit-logger.py
- Implement append-only log storage (immutable)
- Add structured logging for all key events
- Add log integrity verification (hash chains, signatures)
- Add log retention and archiving policies
- Subtasks:
- Create AuditLoggerService class
- Implement append-only log storage (write-once storage)
- Add structured logging for key events (access, modification, export)
- Add log integrity verification (hash chains or digital signatures)
- Add log retention and archiving policies
- Create default audit logger configuration
- Add configuration for storage backend, integrity method
- Acceptance Criteria:
- Audit logger service implements append-only storage
- Structured logging for all key events (access, modification, export)
- Log integrity verification implemented (hash chains or signatures)
- Log retention and archiving policies functional
- Default configuration functional
- Testing:
- Unit tests for audit logger service (>90% coverage)
- Integration tests verifying append-only storage
- Integration tests verifying structured logging for events
- Integration tests verifying log integrity verification
- Integration tests verifying retention and archiving policies
- Default configuration test
- Estimated Complexity: Medium
- Dependencies: Compliance Implementation
- Priority: P7 (After Scalability & Observability Enhancements)
Feature: Security and Compliance Feature Flags
Description: Implement feature flags for safe rollout of security and compliance components.
- Tasks:
- Add feature flags for each security/compliance component
- Wrap service usage with flag checks
- Implement legacy fallback when flags disabled
- Create metrics to compare legacy vs new security/compliance
- Set defaults to false for safe rollout
- Subtasks:
- Add feature flag OCR_USE_ENCRYPTION to configuration
- Add feature flag OCR_USE_DATA_RETENTION to configuration
- Add feature flag OCR_USE_ACCESS_CONTROL to configuration
- Add feature flag OCR_USE_COST_MONITOR to configuration
- Add feature flag OCR_USE_COMPLIANCE to configuration
- Add feature flag OCR_USE_AUDIT_LOGGER to configuration
- Add feature flag OCR_USE_KEY_MANAGER to configuration
- Add feature flag OCR_USE_DATA_CLASSIFIER to configuration
- Add feature flag OCR_USE_CONSENT_MANAGER to configuration
- Add feature flag OCR_USE_SECURE_DELETE to configuration
- Wrap service usage with flag checks
- Implement legacy fallback (unencrypted, no access control, minimal compliance)
- Add metrics comparison (legacy vs new security/compliance)
- Set default values to false
- Create rollback procedure documentation
- Acceptance Criteria:
- Each feature flag controls its respective security/compliance component
- When false, uses legacy minimal security/compliance
- When true, uses respective security/compliance enhancement
- Metrics compare legacy vs new security/compliance (incidents, compliance score, cost)
- Default values are false for safe initial rollout
- Rollback procedure documented and tested
- Testing:
- Unit tests for feature flag wrapping (>90% coverage)
- Integration tests verifying flag behavior (on/off)
- Default value tests (false)
- Metrics comparison test verifying collection and reporting
- Rollback procedure test verifying graceful degradation
- Regression test ensuring existing functionality intact when flags disabled
- Estimated Complexity: Low
- Dependencies: All security and compliance components
- Priority: P7 (After Scalability & Observability Enhancements)
Epic: Continuous Learning & Optimization
Feature: Feedback Collector Implementation
Description: Implement mechanism for collecting user corrections and reviews.
- Tasks:
- Create feedback collector service in backend/services/feedback-collector.py
- Add endpoints for submitting corrections and reviews
- Implement feedback validation and preprocessing
- Add feedback storage with metadata (timestamp, user, context)
- Add feedback metrics and logging
- Subtasks:
- Create FeedbackCollectorService class
- Add endpoints for feedback submission (corrections, reviews)
- Add feedback validation (format, completeness)
- Implement feedback preprocessing (anonymization, normalization)
- Add feedback storage with metadata (timestamp, user_id, doc_id)
- Add feedback metrics (submission rate, correction rate)
- Create default feedback collector configuration
- Add configuration for validation, storage, retention
- Acceptance Criteria:
- Feedback collector service accepts corrections and reviews
- Feedback validation and preprocessing functional
- Feedback storage with metadata works correctly
- Feedback metrics collected (submission rate, correction rate)
- Default configuration functional
- Testing:
- Unit tests for feedback collector service (>90% coverage)
- Integration tests verifying feedback submission endpoints
- Integration tests verifying feedback validation and preprocessing
- Integration tests verifying feedback storage and metadata
- Metrics test confirming collection and reporting
- Default configuration test
- Estimated Complexity: Medium
- Dependencies: Security, Compliance & Cost Management
- Priority: P8 (After Security, Compliance & Cost Management)
Feature: Active Learning Implementation
Description: Implement active learning for uncertain predictions to reduce annotation effort.
- Tasks:
- Create active learning service in backend/services/active-learning.py
- Add uncertainty sampling (entropy, least confidence, margin sampling)
- Implement exploration-exploitation balance
- Add integration with feedback collector and labeling queue
- Add active learning metrics and logging
- Subtasks:
- Create ActiveLearningService class
- Add uncertainty sampling methods (entropy, least confidence)
- Implement exploration-exploitation balance (epsilon-greedy)
- Add integration with feedback collector (uncertain samples)
- Add integration with labeling queue (feed samples to labeling)
- Add active learning metrics (uncertainty reduction, label efficiency)
- Create default active learning configuration
- Add configuration for sampling method, exploration rate
- Acceptance Criteria:
- Active learning service implements uncertainty sampling
- Exploration-exploitation balance implemented
- Integration with feedback collector for uncertain samples
- Integration with labeling queue for sample feeding
- Active learning metrics collected (uncertainty reduction, label efficiency)
- Default configuration functional
- Testing:
- Unit tests for active learning service (>90% coverage)
- Integration tests verifying uncertainty sampling methods
- Integration tests verifying exploration-exploitation balance
- Integration tests verifying feedback collector integration
- Integration tests verifying labeling queue integration
- Metrics test confirming collection and reporting
- Default configuration test
- Estimated Complexity: Medium
- Dependencies: Feedback Collector Implementation
- Priority: P8 (After Security, Compliance & Cost Management)
Feature: Model Retraining Pipeline Implementation
Description: Create model retraining pipeline with validation for continuous improvement.
- Tasks:
- Create model retraining pipeline in backend/services/retraining-pipeline.py
- Add model versioning and storage
- Implement training job orchestration
- Add validation against holdout set and comparison to baseline
- Add model promotion and rollback mechanisms
- Subtasks:
- Create RetrainingPipelineService class
- Add model versioning and storage (registry or model store)
- Implement training job orchestration (start, monitor, complete)
- Add validation against holdout set and comparison to baseline
- Add model promotion (staging → production) and rollback mechanisms
- Add retraining metrics (training time, validation accuracy)
- Create default retraining pipeline configuration
- Add configuration for training data, validation split, promotion criteria
- Acceptance Criteria:
- Model retraining pipeline manages model versioning and storage
- Training job orchestration functional (start, monitor, complete)
- Validation against holdout set and comparison to baseline works
- Model promotion and rollback mechanisms functional
- Retraining metrics collected (training time, validation accuracy)
- Default configuration functional
- Testing:
- Unit tests for retraining pipeline service (>90% coverage)
- Integration tests verifying model versioning and storage
- Integration tests verifying training job orchestration
- Integration tests verifying validation and comparison to baseline
- Integration tests verifying model promotion and rollback
- Metrics test confirming collection and reporting
- Default configuration test
- Estimated Complexity: Medium
- Dependencies: Active Learning Implementation
- Priority: P8 (After Security, Compliance & Cost Management)
Feature: Experiment Framework Implementation
Description: Implement A/B testing framework for features, prompts, and configuration.
- Tasks:
- Create experiment framework service in backend/services/experiment-framework.py
- Add traffic splitting and variant routing and sample splitting mechanisms
- Implement statistical significance testing
- Add experiment tracking and reporting
- Add experiment lifecycle management (start, monitor, stop)
- Subtasks:
- Create ExperimentFrameworkService class
- Add traffic splitting (HTTP requests, OCR processing)
- Add sample splitting (feedback, labeling, training samples)
- Implement statistical significance testing (t-test, chi-square)
- Add experiment tracking and reporting (start/end dates, metrics)
- Add experiment lifecycle management (start, monitor, stop)
- Create default experiment framework configuration
- Add configuration for splitting method, significance threshold
- Acceptance Criteria:
- Experiment framework service implements traffic and sample splitting
- Statistical significance testing implemented
- Experiment tracking and reporting functional
- Experiment lifecycle management (start, monitor, stop) works
- Default configuration functional
- Testing:
- Unit tests for experiment framework service (>90% coverage)
- Integration tests verifying traffic and sample splitting
- Integration tests verifying statistical significance testing
- Integration tests verifying experiment tracking and reporting
- Integration tests verifying experiment lifecycle management
- Metrics test confirming collection and reporting
- Default configuration test
- Estimated Complexity: Medium
- Dependencies: Model Retraining Pipeline Implementation
- Priority: P8 (After Security, Compliance & Cost Management)
Feature: Drift Detector Implementation
Description: Implement drift detection for accuracy, latency, and other key metrics.
- Tasks:
- Create drift detector service in backend/services/drift-detector.py
- Add multiple drift detection methods (EWM, CUSUM, threshold)
- Implement confirmation windows to reduce false positives
- Add drift alerting and notification mechanisms
- Add drift metrics and logging
- Subtasks:
- Create DriftDetectorService class
- Add EWM (Exponentially Weighted Moving) average method
- Add CUSUM (Cumulative Sum) control chart method
- Add threshold-based drift detection method
- Add confirmation windows (require drift over multiple windows)
- Add drift alerting (email, Slack, PagerDuty)
- Add drift metrics (drift rate, confirmation rate)
- Create default drift detector configuration
- Add configuration for detection methods, window sizes, thresholds
- Acceptance Criteria:
- Drift detector service implements multiple detection methods
- Confirmation windows reduce false positives
- Drift alerting and notification mechanisms functional
- Drift metrics collected (drift rate, confirmation rate)
- Default configuration functional
- Testing:
- Unit tests for drift detector service (>90% coverage)
- Integration tests verifying drift detection methods
- Integration tests verifying confirmation windows
- Integration tests verifying drift alerting and notification
- Metrics test confirming collection and reporting
- Default configuration test
- Estimated Complexity: Medium
- Dependencies: Experiment Framework Implementation
- Priority: P8 (After Security, Compliance & Cost Management)
Feature: Model Registry Implementation
Description: Implement model versioning, storage, and rollback capabilities.
- Tasks:
- Create model registry service in backend/services/model-registry.py
- Add model storage with versioning (semantic or build numbers)
- Implement model loading and hot swapping
- Add model metadata storage (accuracy, latency, training data)
- Add model promotion and rollback mechanisms
- Subtasks:
- Create ModelRegistryService class
- Add model storage with versioning
- Implement model loading and hot swapping (zero-downtime)
- Add model metadata storage (accuracy, latency, training data)
- Add model promotion (staging → production) and rollback mechanisms
- Add model registry metrics (hit rate, load latency)
- Create default model registry configuration
- Add configuration for storage backend, versioning scheme
- Acceptance Criteria:
- Model registry service stores models with versioning
- Model loading and hot swapping functional (zero-downtime)
- Model metadata storage works correctly
- Model promotion and rollback mechanisms functional
- Model registry metrics collected (hit rate, load latency)
- Default configuration functional
- Testing:
- Unit tests for model registry service (>90% coverage)
- Integration tests verifying model versioning and storage
- Integration tests verifying model loading and hot swapping
- Integration tests verifying model metadata storage
- Integration tests verifying model promotion and rollback
- Metrics test confirming collection and reporting
- Default configuration test
- Estimated Complexity: Medium
- Dependencies: Drift Detector Implementation
- Priority: P8 (After Security, Compliance & Cost Management)
Feature: Continuous Learning Feature Flags
Description: Implement feature flags for safe rollout of continuous learning components.
- Tasks:
- Add feature flags for each continuous learning component
- Wrap service usage with flag checks
- Implement legacy fallback when flags disabled
- Create metrics to compare legacy vs new learning system
- Set defaults to false for safe rollout
- Subtasks:
- Add feature flag OCR_USE_FEEDBACK_COLLECTOR to configuration
- Add feature flag OCR_USE_ACTIVE_LEARNING to configuration
- Add feature flag OCR_USE_RETRAINING_PIPELINE to configuration
- Add feature flag OCR_USE_EXPERIMENT_FRAMEWORK to configuration
- Add feature flag OCR_USE_DRIFT_DETECTOR to configuration
- Add feature flag OCR_USE_MODEL_REGISTRY to configuration
- Wrap service usage with flag checks
- Implement legacy fallback (static models, no feedback, no experiments)
- Add metrics comparison (legacy vs new learning system)
- Set default values to false
- Create rollback procedure documentation
- Acceptance Criteria:
- Each feature flag controls its respective continuous learning component
- When false, uses legacy static learning system
- When true, respective learning component is enabled
- Metrics compare legacy vs new learning system (accuracy improvement, annotation effort)
- Default values are false for safe initial rollout
- Rollback procedure documented and tested
- Testing:
- Unit tests for feature flag wrapping (>90% coverage)
- Integration tests verifying flag behavior (on/off)
- Default value tests (false)
- Metrics comparison test verifying collection and reporting
- Rollback procedure test verifying graceful degradation
- Regression test ensuring existing functionality intact when flags disabled
- Estimated Complexity: Low
- Dependencies: All continuous learning components
- Priority: P8 (After Security, Compliance & Cost Management)
Epic: Hardening & Documentation
Feature: Security Audit and Penetration Testing
Description: Conduct comprehensive security audit and penetration testing.
- Tasks:
- Schedule and conduct internal security audit
- Schedule and conduct external penetration testing
- Address all critical and high severity findings
- Implement mitigations for medium and low findings as appropriate
- Document all security testing results and remediation
- Subtasks:
- Schedule internal security audit (code review, dependency scan)
- Schedule external penetration testing (OWASP Top 10, API-specific)
- Address critical findings (immediate fixes required)
- Address high severity findings (fix within release cycle)
- Implement mitigations for medium/low findings (accept risk or compensate)
- Document security testing results and remediation actions
- Acceptance Criteria:
- Internal security audit completed with findings documented
- External penetration testing completed with findings documented
- All critical and high severity findings addressed or mitigated
- Medium and low findings appropriately mitigated or accepted with justification
- Security testing results and remediation documented
- Testing:
- Internal security audit findings and remediation
- External penetration testing findings and remediation
- Critical/high findings resolution verification
- Medium/low findings mitigation verification
- Estimated Complexity: Medium
- Dependencies: Continuous Learning & Optimization
- Priority: P9 (After Continuous Learning & Optimization)
Feature: Operational Runbooks and Playbooks
Description: Finalize operational runbooks, playbooks, and incident response procedures.
- Tasks:
- Create operational runbooks for startup, shutdown, backup, recovery
- Create playbooks for specific failure scenarios (worker failure, queue backup)
- Implement incident response procedures and escalation paths
- Add runbook and playbook versioning and review schedule
- Subtasks:
- Create startup and shutdown runbooks
- Create backup and recovery runbooks
- Create worker failure playbook
- Create queue backup playbook
- Create network partitioning playbook
- Create incident response procedures
- Add runbook and playbook versioning
- Add review schedule (quarterly or semi-annual)
- Acceptance Criteria:
- Operational runbooks created for startup, shutdown, backup, recovery
- Playbooks created for specific failure scenarios
- Incident response procedures and escalation paths implemented
- Runbook and playbook versioning implemented
- Review schedule established for operational documentation
- Testing:
- Runbook validation (startup/shutdown procedures)
- Playbook validation (worker failure scenario)
- Playbook validation (queue backup scenario)
- Incident response procedure test
- Versioning and schedule verification
- Estimated Complexity: Low
- Dependencies: Security Audit and Penetration Testing
- Priority: P9 (After Continuous Learning & Optimization)
Feature: API and Integration Documentation
Description: Create comprehensive API and integration documentation.
- Tasks:
- Generate API reference documentation from code annotations
- Create integration guides for major systems (ERP, accounting, inventory)
- Create developer guides for extension and customization points
- Add API versioning and deprecation policies
- Add SDK documentation for supported languages (Python, TypeScript)
- Subtasks:
- Generate API reference from OpenAPI/Swagger annotations
- Create ERP integration guide (SAP, Oracle, Microsoft Dynamics)
- Create accounting system integration guide (QuickBooks, Xero)
- Create inventory system integration guide (WMS, TMS)
- Create developer guide for extension points (engines, validators, UI)
- Add API versioning and deprecation policies
- Create SDK documentation for Python and TypeScript
- Acceptance Criteria:
- API reference documentation generated and comprehensive
- Integration guides created for major systems
- Developer guides created for extension and customization points
- API versioning and deprecation policies implemented
- SDK documentation created for supported languages
- Testing:
- API reference validation (completeness, accuracy)
- Integration guide validation (usability, accuracy)
- Developer guide validation (usability, accuracy)
- SDK documentation validation (completeness, accuracy)
- Estimated Complexity: Medium
- Dependencies: Operational Runbooks and Playbooks
- Priority: P9 (After Continuous Learning & Optimization)
Feature: Performance Optimization Pass
Description: Conduct performance optimization pass to meet all SLAs.
- Tasks:
- Profile system performance under load
- Identify and address performance bottlenecks
- Optimize critical paths (ingestion, classification, OCR, validation)
- Implement caching and precomputation where beneficial
- Add performance regression testing to CI/CD
- Subtasks:
- Profile system under load (100+ documents/minute)
- Identify performance bottlenecks (CPU, GPU, I/O, network)
- Optimize ingestion path (file reading, validation)
- Optimize classification path (feature extraction, model inference)
- Optimize OCR path (engine selection, preprocessing)
- Optimize validation path (rule evaluation, early exits)
- Implement caching and precomputation (frequent documents, rules)
- Add performance regression testing to CI/CD pipeline
- Acceptance Criteria:
- System performance profiled under load
- Performance bottlenecks identified and addressed
- Ingestion path optimized
- Classification path optimized
- OCR path optimized
- Validation path optimized
- Caching and precomputation implemented where beneficial
- Performance regression testing added to CI/CD
- Testing:
- Load testing before and after optimization
- Bottleneck identification and resolution verification
- Path optimization verification (ingestion, classification, OCR, validation)
- Caching and precomputation verification
- Performance regression test in CI/CD
- Estimated Complexity: Medium
- Dependencies: API and Integration Documentation
- Priority: P9 (After Continuous Learning & Optimization)
Feature: Knowledge Transfer and Training
Description: Execute knowledge transfer to operations, support, and product teams.
- Tasks:
- Schedule and conduct knowledge transfer sessions
- Create hands-on labs for common operations and troubleshooting
- Create assessment and feedback mechanisms for knowledge transfer
- Add knowledge transfer materials to internal knowledge base
- Subtasks:
- Schedule knowledge transfer sessions (operations, support, product)
- Create hands-on labs (startup, troubleshooting, backup)
- Create assessment and feedback mechanisms (quizzes, surveys)
- Add knowledge transfer materials to internal knowledge base (Confluence, Notion)
- Add knowledge transfer schedule (regular refreshers)
- Acceptance Criteria:
- Knowledge transfer sessions conducted for all target teams
- Hands-on labs created for common operations and troubleshooting
- Assessment and feedback mechanisms implemented
- Knowledge transfer materials added to internal knowledge base
- Regular knowledge transfer refreshers scheduled
- Testing:
- Knowledge transfer session feedback and assessment
- Hands-on lab validation URL Validation: It is currently not possible to validate URLs provided by the user. Do not attempt to validate this URL.
OCR TARGET ARCHITECTURE BIBLE
What is the OCR Platform?
The FactoryNerve OCR Platform is an intelligent document processing system that transforms physical documents into structured, actionable digital data. It serves as the core document intelligence engine that enables automated data extraction, validation, and integration across factory operations, supply chain management, and administrative workflows.
Why Does it Exist?
The OCR Platform exists to eliminate manual data entry from paper-based factory documents, reduce human error, accelerate processing times, enable real-time data access, and provide the foundation for data-driven decision making in manufacturing operations. It bridges the gap between physical documentation and digital factory systems.
What are its Responsibilities?
The OCR Platform is responsible for:
- Accepting physical document images (scans, photos) as input
- Automatically identifying document types (invoices, delivery notes, weighbridge tickets, etc.)
- Extracting structured data from documents with high accuracy
- Validating extracted data against business rules and document semantics
- Providing confidence scores for all extracted fields
- Enabling human review and correction when needed
- Exporting validated data to downstream systems (ERP, accounting, inventory)
- Maintaining audit trails for compliance and traceability
- Supporting continuous learning from user corrections
- Scaling to handle high volumes of documents in factory environments
What are its Boundaries?
The OCR Platform boundaries are defined by:
- Input: Accepts image files (PNG, JPG, PDF, TIFF) of physical documents
- Core Processing: Performs document classification, OCR extraction, validation, and enrichment
- Output: Provers structured JSON data with metadata, confidence scores, and validation results
- Integration Points: Connects to factory systems via APIs, webhooks, or direct database writes
- Exclusions: Does not include ERP functionality, inventory management, or financial processing - these are handled by downstream systems
What Components Exist?
The OCR Platform consists of these core components:
Core Services Layer
 1. Pre-flight Analysis Service - Analyzes image quality, detects scripts, estimates layout
 2. Document Classification Service - Identifies document type using text and visual features
 3. Document Registry - Central repository of document type definitions, schemas, and processing rules
 4. Prompt Engineering Service - Generates type-optimized prompts for OCR engines
 5. OCR Engine Abstraction Layer - Pluggable interface supporting multiple OCR technologies
 6. Validation Pipeline - Multi-stage validation (structural, schema, business, semantic)
 7. Confidence Calibration Service - Ensures confidence scores reflect true accuracy
 8. Response Building Service - Constructs standardized OCR result format
 9. Preprocessing Service - Applies image enhancements optimized per document type
10. Post-processing Service - Applies language models and corrections to raw OCR output
Infrastructure Layer
11. Caching Layer - Redis-based caching for frequent document types
12. Message Queue - Enables asynchronous processing and load leveling
13. Worker Pools - Specialized CPU/GPU workers for different processing stages
14. Monitoring & Telemetry - Collects metrics, traces, and logs for observability
15. Security Layer - Handles encryption, access controls, and compliance
16. Configuration Management - Centralized feature flags and settings
17. Feedback Collection - Captures user corrections for continuous learning
Presentation Layer
18. Adaptive Rendering Engine - Selects appropriate UI based on document complexity
19. Review Workflow Manager - Coordinates human-in-the-loop processes
20. Export Engine - Generates outputs in multiple formats (Excel, PDF, JSON, XML)
How Do Components Communicate?
Components communicate through well-defined interfaces:
- Service-to-Service: REST/gRPC APIs with protobuf or JSON payloads
- Internal Messaging: Asynchronous message queues for decoupled processing
- Shared State: Distributed cache (Redis) for temporary results and session data
- Events: Event-driven architecture for status updates and triggering workflows
- Synchronous Calls: Direct service calls for low-latency, request-response interactions
What Services Exist?
The platform provides these core services:
- Document Ingestion Service - Accepts and validates incoming document images
- Classification Service - Determines document type with confidence scores
- OCR Orchestration Service - Manages the end-to-end processing pipeline
- Validation Service - Applies multi-layer validation rules
- Enrichment Service - Adds contextual information and corrections
- Response Service - Formats output for consumption by clients
- Feedback Service - Collects and processes user corrections
- Monitoring Service - Exposes metrics and health checks
- Security Service - Manages authentication, authorization, and encryption
- Configuration Service - Provides runtime configuration and feature flags
What Modules Exist?
The platform is organized into these functional modules:
- ingestion - Document intake and initial validation
- analysis - Image preprocessing and quality assessment
- classification - Document type identification
- registry - Document type definitions and processing rules
- prompt - Prompt generation and management
- ocr - OCR engine abstraction and execution
- validation - Data validation and business rule enforcement
- response - Result formatting and enrichment
- presentation - UI rendering and user interaction
- infrastructure - Caching, queuing, worker management
- observability - Logging, metrics, tracing, alerting
- security - Authentication, authorization, encryption, compliance
- feedback - Learning from user corrections
What Abstractions Exist?
Key abstractions in the platform include:
- OCREngine Interface - Standard contract for all OCR implementations
- DocumentTypeConfig - Metadata-driven definition of document types
- ValidationRule - Composable validation logic
- ProcessingPipeline - Configurable sequence of processing steps
- ConfidenceScore - Standardized confidence representation
- OCRResult - Standardized output format for all processing
- FeatureFlag - Runtime toggle for functionality
- ProcessingContext - Immutable context passed through pipeline stages
How is Extensibility Achieved?
Extensibility is achieved through:
- Plugin Architecture - New OCR engines implement the OCREngine interface
- Registry-Driven Configuration - New document types added via configuration files without code changes
- Versioned APIs - Backward compatible service interfaces
- Metadata-Driven Behavior - UI, validation, and processing rules driven from document registry
- Hook System - Extension points for custom validation, enrichment, and export logic
- Template System - Customizable prompts and response formats per document type
How is Maintainability Achieved?
Maintainability is achieved through:
- Separation of Concerns - Clear boundaries between services with single responsibilities
- Interface Stability - Well-defined, versioned contracts between components
- Configuration Over Convention - Behavior driven from external configuration
- Observability-First Design - Comprehensive logging, metrics, and tracing built-in
- Automated Testing - High test coverage with contract testing between services
- Documentation as Code - API specifications and architecture decisions stored with code
- Feature Flags - Safe deployment and rollback capabilities
- Modular Deployment - Independent scaling and updating of services
How are New Document Types Added?
New document types are added through:
1. Registry Entry - Create a new entry in the document registry with:
- Document type ID and name
- UI component mapping
- Extraction prompt template
- JSON schema for expected output
- Validation rules (required fields, value ranges, cross-field checks)
- Business rules (format validations, custom logic)
- UI configuration (field grouping, sections, repeatable sections)
- Export rules (format, column mapping, sheet names)
- Preprocessing profile (optimized image enhancements)
- Confidence thresholds (auto-accept, review required)
- Feature flags (type-specific capabilities)
2. UI Component (Optional) - Create specialized UI component for complex document types
3. Validation Rules (Optional) - Add custom validation logic if needed
4. No Code Changes Required - Core processing pipeline works with any registered document type
How are New OCR Engines Added?
New OCR engines are added through:
1. Implement OCREngine Interface - Create a class that implements the standard OCR engine contract
2. Register Engine - Add the engine to the OCR engine registry with:
- Engine identifier and display name
- Supported document types and languages
- Performance characteristics (latency, cost, accuracy profiles)
- Resource requirements (CPU/GPU, memory)
- Capabilities (handwriting, multi-language, layout understanding)
- Configuration parameters (model versions, tuning parameters)
3. Define Engine-Specific Preprocessing - Create preprocessing profiles optimized for the engine
4. Configure Routing Rules - Add routing logic to the engine selector based on document attributes
5. No Core Pipeline Changes - The orchestration layer works with any registered engine
How is Vendor Independence Achieved?
Vendor independence is achieved through:
- OCREngine Abstraction - All vendors implement the same interface
- Adapter Pattern - Vendor-specific SDKs wrapped in platform adapters
- Configuration-Driven Selection - Engine choice based on document attributes and policies
- Feature Parity Requirements - All engines must support core capabilities (text extraction, bounding boxes, confidence)
- Fallback Mechanisms - Automatic fallback to alternative engines on failure
- Cost-Aware Routing - Ability to prefer lower-cost options when accuracy is sufficient
- Response Normalization - Standardized output format regardless of underlying engine
How is AI Vendor Lock-in Avoided?
AI vendor lock-in is avoided through:
- Multi-Model Support - Simultaneous support for multiple AI/ML providers
- Abstract AI Service Layer - Common interface for all AI providers (Anthropic, OpenAI, Azure, Google)
- Model Versioning - Ability to specify and upgrade model versions independently
- Cost Optimization - Routing to most cost-effective provider meeting accuracy requirements
- Performance Benchmarking - Continuous evaluation of provider performance
- Data Portability - Standardized input/output formats enable easy migration
- Prompt Abstraction - Prompts engineered to work across similar model families
- Fallback to Open Source - Ability to fall back to self-hosted models (Tesseract, Donut, TrOCR)
- No Proprietary Data Formats - Use of standard JSON/image formats throughout
How Does the Complete Document Lifecycle Work?
The document lifecycle follows these stages:
 1. Ingestion - Document image received via API/upload, validated for format/size, virus scanned
 2. Pre-flight Analysis - Image quality assessment, script detection, layout estimation, orientation correction
 3. Classification - Document type identification using text/visual features with confidence scoring
 4. Registry Lookup - Retrieve document type configuration (prompts, schemas, rules, UI mapping)
 5. Preprocessing - Apply document-type-specific image enhancements (deskew, CLAHE, denoise, etc.)
 6. Prompt Generation - Create type-optimized prompt with anti-injection hardening
 7. OCR Execution - Execute selected OCR engine(s) with generated prompt
 8. Post-processing - Apply language model corrections, confidence calibration, and enrichment
 9. Validation - Apply multi-stage validation (structural, schema, business, semantic)
10. Response Building - Construct standardized OCR result with metadata, confidence, and validation results
11. Caching - Store result in cache for potential reuse
12. Presentation - Route to appropriate UI component based on document type and complexity
13. Review - Optional human review and correction with field-level guidance
14. Approval - Optional approval workflow for high-value or regulated documents
15. Export - Generate output in requested format(s) and deliver to downstream systems
16. Archiving - Store original image and OCR result per retention policy
17. Feedback - Capture user corrections for continuous learning and model improvement
18. Metrics - Record processing metrics, latency, cost, and accuracy for observability
How are Documents Processed?
Documents are processed through a configurable pipeline:
Sequential Processing Path:
Ingestion → Pre-flight Analysis → Classification → Registry Lookup → Preprocessing → 
Prompt Generation → OCR Execution → Post-processing → Validation → Response Building → 
Caching → Presentation
Parallel Processing Opportunities:
- Pre-flight analysis and initial lightweight classification can run in parallel
- Multiple OCR engines can be run simultaneously for consensus or fallback
- Validation stages can be pipelined for efficiency
- Post-processing steps (language modeling, enrichment) can be parallelized
Conditional Processing:
- High-confidence classifications may skip visual validation
- Simple documents may bypass expensive AI engines
- Cached results bypass processing entirely
- Low-confidence results trigger additional verification steps
How are Documents Validated?
Documents undergo multi-stage validation:
1. Structural Validation - Checks basic OCR output integrity (row/column consistency, empty cell ratio, alignment)
2. Schema Validation - Validates against document-type-specific JSON schema (required fields, types, patterns, enums)
3. Business Rule Validation - Applies document-type-specific rules (value ranges, cross-field checks, format validations, custom logic)
4. Semantic Validation - Applies AI/ML-enhanced checks (anomaly detection, trend analysis, fraud indicators, historical comparison)
5. Consistency Validation - Checks for internal consistency (mathematical relationships, logical constraints)
6. Compliance Validation - Ensures adherence to regulatory requirements (tax formats, audit trails, data retention)
Each validation stage produces field-specific errors/warnings with suggested corrections where applicable. Validation failures can be configured to block export or require human review.
How are Documents Rendered?
Documents are rendered through an adaptive presentation layer:
Rendering Process:
1. Extract document type and complexity metrics from OCR result
2. Calculate data density (field count × row/column count)
3. Select appropriate layout mode based on density and document type:
- Card View (< 10 fields, no repeating sections) - Form-style layout
- Compact Table (< 50 cells) - Simple editable table
- Sectioned Table (50-200 cells) - Collapsible sections with summary rows
- Paginated Table (> 200 cells) - Virtual scrolling with header statistics
- Tabbed View (Complex documents) - Organized sections in tabs
- Two-Panel View (Specific types like delivery notes) - Split layout for header/items
- Key-Value View (Handwritten forms) - Dynamic field listing
- Message List View (Transcripts, chats) - Chronological message display
Rendering Features:
- Field-level confidence visualization (color-coded badges, tooltips)
- Structural awareness (headers, line items, totals, tax sections)
- Support for repeating sections (line items, tax details)
- Inline correction with instant re-validation
- Smart navigation (jump to next uncertain field, batch similar field types)
- Change tracking with audit trail and undo/redo
- Export readiness indicators and preview
- Accessibility compliance (WCAG 2.1 AA)
- Responsive design for tablet/desktop use
How are Documents Exported?
Documents are exported through a flexible export engine:
Export Formats:
- Excel (.xlsx) - With formatting, data validation, and multiple sheets
- PDF - Searchable text with original image overlay
- JSON - Full structured OCR result with all metadata
- XML - Customizable schema for system integration
- CSV - Simple tabular data for basic systems
- EDI/X12 - Standard formats for supply chain integration
Export Features:
- Configurable column mapping and formatting per document type
- Support for multiple sheets/workbooks (summary + details)
- Embedded original images in PDF exports
- Data validation rules in Excel exports (dropdowns, constraints)
- Configurable headers, footers, and metadata inclusion
- Streaming export for large documents to prevent memory issues
- Integration hooks for direct database writes or API calls
- Audit trail inclusion in exports for compliance
- Encryption and secure transfer options for sensitive data
How are Documents Archived?
Documents are archived according to configurable retention policies:
Archiving Process:
 1. Original document image stored with SHA-256 hash for integrity verification
 2. Complete OCR result (including all metadata and processing history) stored
 3. Processing metrics, latency, and cost data retained for analytics
 4. User interaction history (reviews, corrections, approvals) preserved
 5. All data encrypted at rest using AES-256-GCM
 6. Storage tiering based on access frequency (hot/warm/cold)
 7. Automated cleanup based on retention policies (tax documents: 7 years, operational: 2 years, etc.)
 8. Legal hold capability to preserve documents during investigations
 9. Audit logging of all access and modification events
10. Disaster recovery and backup procedures for archived data
Archiving Policies:
- Configurable retention periods per document type and jurisdiction
- Automatic encryption and compression of archived data
- Geo-replication for disaster recovery
- Access controls aligned with data sensitivity and user roles
- Export capabilities for legal discovery and compliance requests
- Metadata indexing for efficient search and retrieval
- Storage cost optimization through lifecycle management
- Integration with enterprise archiving and records management systems
OCR ENGINEERING MASTER PLAN
Phase 0: Foundation & Observability
Purpose: Establish monitoring, logging, and foundational services to create a measurable, observable baseline for the transformation.
Objectives:
- Implement structured logging with distributed tracing capabilities
- Add comprehensive Prometheus metrics for latency, throughput, error rates, and resource utilization
- Create centralized configuration management system with feature flag infrastructure
- Establish baseline performance measurements for all critical paths
- Implement structured error handling and reporting mechanisms
Business Value:
- Provides visibility into system performance and health from day one
- Enables data-driven decision making for optimization efforts
- Reduces mean time to detection (MTTD) and mean time to resolution (MTTR) for issues
- Creates foundation for SLAs and performance guarantees
- Enables proactive capacity planning and resource optimization
Dependencies: None (foundational phase)
Files/Modules Affected:
- backend/logging.py - Structured logging with trace ID propagation
- backend/metrics.py - Prometheus metrics collection and exposition
- backend/config.py - Centralized configuration management with feature flags
- backend/middleware/ - Request/response middleware for metrics and logging
- Dockerfiles - Enhanced for metrics exposition and health checks
- ci/cd/pipelines.yaml - Updated for metric collection and reporting
- monitoring/ - Dashboards and alerting rules configuration
- backend/health.py - Comprehensive health check endpoints
Engineering Risks:
- Low: Over-engineering logging/metrics - Mitigation: Start with essential metrics, iterate based on observed needs
- Low: Performance overhead from instrumentation - Mitigation: Use efficient sampling, async processing where possible
- Low: Configuration complexity - Mitigation: Hierarchical configuration with sensible defaults
- Low: Tooling compatibility issues - Mitigation: Standardize on open-source tools (Prometheus, Grafana, Jaeger/OTel)
Testing Strategy:
- Unit tests for all new logging/metrics functionality
- Integration tests verifying metric collection and exposition
- Load testing to measure instrumentation tests confirming acceptable performance overhead (<5%)
- Security scans to ensure no information leakage in logs/metrics
- Chaos engineering tests to validate observability during failures
Rollback Strategy:
- N/A: Additive changes only - Logging/metrics/configuration additions can remain even if other phases are rolled back
- Instant Rollback: Feature flags can disable new logging endpoints if needed
- Data Preservation: No destructive changes to existing data structures
Success Criteria:
- All services emit structured logs with trace IDs
- Key metrics (request latency, error rate, throughput, resource utilization) visible in Grafana dashboards
- Configuration system supports hierarchical overrides and feature flags
- Baseline performance measurements established for all critical paths
- Health check endpoints return accurate service status
Acceptance Criteria:
- Logging follows structured format (JSON) with required fields (timestamp, level, message, trace_id, service_name)
- Metrics endpoint exposes at least: ocr_request_duration_seconds, ocr_requests_total, ocr_errors_total, ocr_active_requests
- Configuration system allows environment-specific overrides without code changes
- Feature flag infrastructure enables/disables functionality without redeployment
- Baseline measurements captured for: end-to-end latency, classification accuracy, OCR success rate, cache hit ratio
Definition of Done:
- Structured logging implemented across all services
- Prometheus metrics endpoint exposed and scraping successfully
- Centralized configuration management in place
- Feature flag system operational with web UI for toggling
- Baseline performance dashboard created and populated
- All new code has >80% unit test coverage
- Security review completed for logging/metrics endpoints
- Documentation updated for new logging/metrics/configuration systems
- Knowledge transfer session conducted with platform team
Phase 1: Classification Integration
Purpose: Fix the critical classifier bypass issue by integrating document classification early in the pipeline to enable type-specific processing.
Objectives:
- Integrate DocumentClassifier into OCR pipeline before engine selection
- Modify classifier to return confidence scores with predictions
- Implement fallback logic for low-confidence classifications
- Register all existing document types in the new document registry
- Ensure backward compatibility with existing processing flows
Business Value:
- Unlocks all existing type-specific UI components (InvoiceReviewView, DeliveryNoteReviewView, etc.)
- Immediately improves user experience by showing appropriate interfaces
- Reduces processing costs by enabling early routing to appropriate engines
- Lays foundation for all future type-specific enhancements
- Delivers immediate value with relatively low implementation risk
Dependencies: Phase 0 (Foundation & Observability)
Files/Modules Affected:
- backend/services/classifier.py - Enhanced to return confidence scores
- backend/services/classification_pipeline.py (NEW) - Orchestrates multi-stage classification
- backend/services/document_registry.py (NEW) - Central document type registry
- backend/routers/ocr/_common.py - Modify _run_table_preview_pipeline to call classifier
- backend/services/ocr_document_pipeline.py - Modify build_structured_ocr_result to use classification results
- backend/models/document_type.py (NEW) - Document type data models
- backend/api/v1/endpoints/classify.py (NEW) - Classification API endpoint
- frontend/src/lib/document-types.ts (NEW) - Frontend document type definitions
Engineering Risks:
- Medium: Classification accuracy degradation - Mitigation: Confidence thresholding, fallback to visual classification, continuous learning
- Medium: Pipeline disruption risk - Mitigation: Feature flagged rollout, parallel run with legacy system
- Low: Increased latency from additional processing - Mitigation: Optimize classifier, early exits for high confidence
- Low: Data model changes - Mitigation: Backward compatible schema evolution, migration scripts
Testing Strategy:
- Unit tests for classifier confidence scoring and calibration
- Integration tests verifying correct UI routing for all document types
- Regression tests ensuring existing functionality remains intact
- Performance tests measuring classification latency impact
- A/B tests comparing legacy vs new pipeline accuracy and speed
- Edge case testing for unknown/ambiguous document types
- Security testing for classification API endpoint
Rollback Strategy:
- Feature Flag: OCR_USE_CLASSIFIER_PIPELINE (default: false → true)
- Instant Rollback: If issues arise, set flag to false to bypass new pipeline
- Parallel Run Capability: Ability to route percentage of traffic to new vs legacy pipeline for comparison
- Data Preservation: No schema changes requiring migration
Success Criteria:
- ≥ 95% classification accuracy on validated test set
- All existing document types route to correct UI components in frontend
- No regression in end-to-end processing time or error rate
- Classification confidence scores correlate with actual accuracy
- Fallback logic properly handles low-confidence cases
Acceptance Criteria:
- Classifier returns prediction with confidence score (0.0-1.0)
- System routes to type-specific UI when classification confidence ≥ threshold
- Low-confidence classifications trigger appropriate fallback mechanisms
- All legacy document types (GST invoice, delivery note, weighbridge, etc.) correctly identified
- Unknown document types routed to generic processing with manual review flag
- Classification results cached appropriately to avoid redundant processing
- End-to-end latency increase < 10% for successfully classified documents
Definition of Done:
- Classification pipeline implemented with confidence scoring
- Document registry populated with all existing document types
- OCR pipeline modified to call classification before engine selection
- Frontend routing updated to use classification results
- Feature flag OCR_USE_CLASSIFIER_PIPELINE implemented
- Unit tests for classification pipeline (>90% coverage)
- Integration tests verifying correct document routing
- Regression tests confirming no legacy functionality broken
- Performance benchmark showing <10% latency impact
- Security review completed for classification endpoints
- Documentation updated for classification API and registry
- Knowledge transfer session conducted with frontend and backend teams
Phase 2: Registry-Driven Prompts & Schema
Purpose: Enable type-specific OCR processing by moving prompts and JSON schemas to the document registry, implementing prompt rendering engine with versioning, and adding schema validation with anti-injection hardening.
Objectives:
- Move prompts and JSON schemas from hardcoded strings to document registry entries
- Implement prompt rendering engine with variable substitution, version control, and A/B testing support
- Add schema validation layer to enforce structured outputs from OCR engines
- Implement multi-layer anti-injection hardening (input sanitization, system prompt hardening, output validation)
- Establish A/B testing framework for prompt experimentation and optimization
Business Value:
- Enables type-specific OCR processing that improves extraction accuracy
- Eliminates hardcoded prompts, enabling easy addition of new document types
- Provides structured output validation that catches hallucinations and format errors
- Implements defense-in-depth against prompt injection attacks
- Allows data-driven prompt optimization through A/B testing
- Reduces prompt engineering effort through template reuse and versioning
Dependencies: Phase 1 (Classification Integration)
Files/Modules Affected:
- backend/services/document_registry.py - Extended to store prompts and schemas
- backend/services/prompt_service.py (NEW) - Prompt rendering, versioning, and A/B testing
- backend/services/validation_service.py (NEW) - Schema validation and anti-injection layers
- backend/routers/ocr/_common.py - Modify _call_table_excel_anthropic to use registry-driven prompts
- backend/services/ocr_document_pipeline.py - Update validation to use schema validation
- backend/models/prompt_template.py (NEW) - Prompt template data model
- backend/models/validation_rule.py (NEW) - Validation rule data model
- backend/services/experiment_framework.py (NEW) - A/B testing framework for prompts
- frontend/src/lib/prompt-templates.ts (NEW) - Frontend prompt definitions
Engineering Risks:
- Medium: Prompt rendering errors causing OCR failures - Mitigation: Comprehensive template testing, fallback to hardcoded prompts
- Medium: Schema validation rejecting valid outputs - Mitigation: Gradual rollout, warning-only mode initially
- Low: Performance overhead from prompt processing - Mitigation: Template caching, efficient variable substitution
- Low: A/B testing complexity - Mitigation: Simple traffic splitting, clear success metrics
Testing Strategy:
- Unit tests for prompt rendering with various variable substitutions
- Integration tests verifying correct prompt generation for all document types
- Schema validation tests covering valid/invalid outputs
- Anti-injection penetration tests (OWASP-inspired prompt injection attempts)
- A/B testing framework validation with traffic splitting and metrics collection
- Performance tests measuring prompt generation overhead
- Security tests for prompt service endpoints
- Backward compatibility tests with legacy hardcoded prompts
Rollback Strategy:
- Feature Flag: OCR_USE_REGISTRY_PROMPTS (default: false → true)
- Instant Rollback: If issues, set flag to false to use hardcoded prompts
- Selective Rollback: Per-document-type flags for granular control
- Fallback Mechanism: Automatic fallback to hardcoded prompts on rendering/validation errors
Success Criteria:
- 100% of document types use registry-driven prompts
- Schema validation passes for ≥ 99% of extractions
- No successful prompt injection attempts in security testing
- A/B testing framework functional with measurable impact on accuracy
- Fallback mechanisms for the of the hard-coded prompts
Acceptance Criteria:
- Prompts correctly rendered with all required variables substituted
- Schema validation rejects structurally invalid OCR outputs
- Anti-injection layers block common prompt injection techniques
- A/B testing framework properly splits traffic and measures conversion metrics
- Prompt versioning allows rollback to previous versions
- Experiment tracking captures metrics for each prompt variant
- Legacy hardcoded prompts still functional when feature flag disabled
Definition of Done:
- Prompt service implemented with rendering, versioning, and A/B testing capabilities
- Document registry extended to store prompts and JSON schemas
- Validation service implemented with schema validation and anti-injection layers
- OCR pipeline modified to use registry-driven prompts and validation
- Feature flag OCR_USE_REGISTRY_PROMPTS implemented
- Unit tests for prompt service (>90% coverage)
- Integration tests verifying correct prompt usage per document type
- Security testing confirming resistance to prompt injection
- A/B testing framework validated with traffic splitting
- Performance bench showing <5% overhead from prompt processing
- Documentation updated for prompt service, registry, and validation
- Knowledge transfer session conducted with backend and frontend teams
Phase 3: Pluggable OCR Engine Layer
Purpose: Implement engine abstraction and routing to support multiple OCR technologies with intelligent selection based on document attributes and policies.
Objectives:
- Define OCREngine interface as standard contract for all OCR implementations
- Integrate Tesseract (baseline), Donut, and Azure Read engines as initial implementations
- Implement intelligent routing based on document type, quality analysis, and policies
- Add cost tracking and circuit breaker pattern per engine for resilience
- Establish engine performance benchmarking and monitoring capabilities
Business Value:
- Enables selection of optimal OCR engine per document type (cost, accuracy, speed)
- Provides resilience through automatic fallback and circuit breaking
- Lays foundation for future engine additions without pipeline changes
- Enables cost optimization through routing to most efficient adequate engine
- Provides performance monitoring and bottleneck identification
- Reduces vendor lock-in through abstraction layer
Dependencies: Phase 1-2 (Classification Integration, Registry-Driven Prompts & Schema)
Files/Modules Affected:
- backend/services/ocr_engine.py (NEW) - OCREngine interface definition
- backend/services/ocr_engine_registry.py (NEW) - Engine registration and lookup
- backend/services/engine_router.py (NEW) - Intelligent engine selection logic
- backend/services/tesseract_engine.py (NEW) - Tesseract OCR implementation
- backend/services/donut_engine.py (NEW) - Donut vision model implementation
- backend/services/azure_read_engine.py (NEW) - Azure Computer Vision Read implementation
- backend/services/cost_tracker.py (NEW) - Per-engine cost monitoring
- backend/services/circuit_breaker.py (NEW) - Resilience pattern implementation
- backend/services/benchmark_suite.py (NEW) - Engine performance benchmarking
- backend/routers/ocr/_common.py - Replace direct engine calls with orchestrated selection
- backend/services/document_registry.py - Add engine preferences to document types
- backend/services/preprocessing_service.py - Extend for engine-specific preprocessing profiles
Engineering Risks:
- High: Architectural complexity from abstraction layer - Mitigation: Start with 1-2 engines, iterate, maintain clear interfaces
- High: Integration challenges with diverse OCR technologies - Mitigation: Adapter pattern, thorough testing per engine
- Medium: Performance overhead from routing and abstraction - Mitigation: Optimize critical paths, benchmark regularly
- Medium: Engine-specific quirks and error handling - Mitigation: Comprehensive adapter testing, fallback mechanisms
- Low: Cost tracking accuracy - Mitigation: Regular auditing against actual provider bills
Testing Strategy:
- Unit tests for OCREngine interface compliance per implementation
- Integration tests verifying correct engine selection based on document attributes
- Performance benchmarking comparing engine latency, throughput, and resource usage
- Circuit breaker failure simulation and recovery testing
- Cost tracking accuracy validation against actual usage
- Engine-specific feature tests (handwriting, multi-language, layout understanding)
- Load testing to verify horizontal scaling capabilities
- Security testing for engine adapter endpoints
- Chaos engineering tests for engine failure scenarios
Rollback Strategy:
- Feature Flag: OCR_USE_PLUGGABLE_ENGINES (default: false → true)
- Per-Engine Flags: Individual flags for each engine (e.g., OCR_USE_TESSERACT, OCR_USE_DONUT, OCR_USE_AZURE_READ)
- Instant Rollback: Disable flags to revert to legacy engine usage
- Gradual Rollout: Route percentage of traffic to new engine orchestration
- Fallback Chains: Automatic fallback to legacy engines on failure
Success Criteria:
- All three engines (Tesseract, Donut, Azure) successfully integrated
- Routing correctly selects engine based on document attributes and policies
- Cost tracking accurate within 10% of actual provider charges
- Circuit breakers engage appropriately on simulated engine failures
- System maintains ≥ 95% of legacy OCR accuracy while enabling engine selection
Acceptance Criteria:
- OCREngine interface properly implemented by all engine adapters
- Engine selector chooses Tesseract for simple high-quality prints
- Engine selector chooses Donut/Azure for complex forms, handwriting, low-quality scans
- Cost tracking records actual usage costs per engine
- Circuit breakers open after threshold of failures, redirect traffic to alternatives
- Engine benchmarking suite provides comparable performance metrics
- Legacy engine still functional when new orchestration disabled
- No regression in end-to-end accuracy for documents processed by legacy engine
Definition of Done:
- OCREngine interface defined and implemented by Tesseract, Donut, Azure adapters
- Engine registry and router implemented with intelligent selection logic
- Cost tracking and circuit breaker patterns implemented per engine
- OCR pipeline modified to use engine orchestration layer
- Feature flags for orchestration and individual engines implemented
- Unit tests for all engine adapters (>80% coverage each)
- Integration tests verifying correct engine selection and routing
- Performance benchmarking suite established and baseline measurements taken
- Circuit breaker failure/recovery tested successfully
- Cost tracking validated against actual usage (within 10%)
- Security review completed for all engine adapter endpoints
- Documentation updated for OCREngine interface, registry, and routing
- Knowledge transfer session conducted with backend, ML, and DevOps teams
Feature: Tesseract Engine Adapter
Description: Implement Tesseract OCR engine as first engine adapter.
- Tasks:
- Create Tesseract engine adapter in backend/services/tesseract_engine.py
- Implement OCREngine interface for Tesseract
- Add Tesseract-specific options (psm, oem, language, config)
- Implement subprocess execution with timeout
- Add Tesseract output parsing to OCRResult format
- Add Tesseract-specific preprocessing profile support
- Subtasks:
- Create TesseractEngine class implementing OCREngine
- Implement process() method with image and options
- Add Tesseract-specific options (psm, oem, lang, config)
- Implement subprocess execution with timeout
- Add Tesseract output parsing (hOCR or TSV to OCRResult)
- Implement error handling and timeout logic
- Add Tesseract-specific preprocessing profile support
- Add capability reporting (languages, limited handwriting)
- Create default preprocessing profile for Tesseract
- Add metrics (latency, success rate, OOM kills)
- Acceptance Criteria:
- TesseractEngine implements OCREngine interface
- process() method handles image and options correctly
- Tesseract-specific options supported (psm, oem, lang, config)
- Subprocess execution with timeout implemented
- Output parsed correctly to OCRResult format
- Error handling and timeout logic functional
- Preprocessing profile support implemented
- Capability reporting accurate (languages, basic handwriting)
- Default preprocessing profile created
- Metrics collected (latency, success rate)
- Testing:
- Unit tests for TesseractEngine (>90% coverage)
- Integration tests verifying OCREngine interface compliance
- Integration tests verifying Tesseract-specific options
- Integration tests verifying subprocess timeout handling
- Integration tests verifying output parsing
- Integration tests verifying error and timeout handling
- Integration tests verifying preprocessing profile support
- Capability reporting test
- Default preprocessing profile test
- Metrics test confirming collection and reporting
- Estimated Complexity: Medium
- Dependencies: OCREngine Interface Definition, OCR Engine Registry, Engine Router
- Priority: P2 (After Registry-Driven Prompts & Schema)
Feature: Donut Engine Adapter
Description: Implement Donut vision model engine as second engine adapter.
- Tasks:
- Create Donut engine adapter in backend/services/donut_engine.py
- Implement OCREngine interface for Donut
- Add Donut-specific options (model version, device, batch size)
- Implement model loading and inference
- Add Donut output parsing to OCRResult format
- Add Donut-specific preprocessing profile support
- Subtasks:
- Create DonutEngine class implementing OCREngine
- Implement process() method with image and options
- Add Donut-specific options (model, device, batch_size)
- Implement model loading and inference
- Add Donut output parsing (JSON to OCRResult)
- Implement error handling and timeout logic
- Add Donut-specific preprocessing profile support
- Add capability reporting (layout_understanding, multi_language)
- Create default preprocessing profile for Donut
- Add metrics (latency, success rate, GPU utilization)
- Acceptance Criteria:
- DonutEngine implements OCREngine interface
- process() method handles image and options correctly
- Donut-specific options supported (model, device, batch_size)
- Model loading and inference implemented
- Output parsed correctly to OCRResult format
- Error handling and timeout logic functional
- Preprocessing profile support implemented
- Capability reporting accurate (layout understanding, multi-language)
- Default preprocessing profile created
- Metrics collected (latency, success rate, GPU utilization)
- Testing:
- Unit tests for DonutEngine (>90% coverage)
- Integration tests verifying OCREngine interface compliance
- Integration tests verifying Donut-specific options
- Integration tests verifying model loading and inference
- Integration tests verifying output parsing
- Integration tests verifying error and timeout handling
- Integration tests verifying preprocessing profile support
- Capability reporting test
- Default preprocessing profile test
- Metrics test confirming collection and reporting
- Estimated Complexity: Medium
- Dependencies: OCREngine Interface Definition, OCR Engine Registry, Engine Router
- Priority: P2 (After Registry-Driven Prompts & Schema)
Feature: Azure Read Engine Adapter
Description: Implement Azure Computer Vision Read engine as third engine adapter.
- Tasks:
- Create Azure Read engine adapter in backend/services/azure_read_engine.py
- Implement OCREngine interface for Azure Read
- Add Azure Read-specific options (model version, language hints, features)
- Implement API client with authentication and retry logic
- Add Azure Read output parsing to OCRResult format
- Add Azure Read-specific preprocessing profile support
- Subtasks:
- Create AzureReadEngine class implementing OCREngine
- Implement process() method with image and options
- Add Azure Read-specific options (model, language_hints, features)
- Implement API client with authentication and retry logic
- Add Azure Read output parsing (JSON to OCRResult)
- Implement error handling and timeout logic
- Add Azure Read-specific preprocessing profile support
- Add capability reporting (handwriting, multi_language, layout_understanding)
- Create default preprocessing profile for Azure Read
- Add metrics (latency, success rate, API calls, cost)
- Acceptance Criteria:
- AzureReadEngine implements OCREngine interface
- process() method handles image and options correctly
- Azure Read-specific options supported (model, language_hints, features)
- API client with authentication and retry logic implemented
- Output parsed correctly to OCRResult format
- Error handling and timeout logic functional
- Preprocessing profile support implemented
- Capability reporting accurate (handwriting, multi_language, layout_understanding)
- Default preprocessing profile created
- Metrics collected (latency, success rate, API calls, cost)
- Testing:
- Unit tests for AzureReadEngine (>90% coverage)
- Integration tests verifying OCREngine interface compliance
- Integration tests verifying Azure Read-specific options
- Integration tests verifying API client and retry logic
- Integration tests verifying output parsing
- Integration tests verifying error and timeout handling
- Integration tests verifying preprocessing profile support
- Capability reporting test
- Default preprocessing profile test
- Metrics test confirming collection and reporting
- Estimated Complexity: Medium
- Dependencies: OCREngine Interface Definition, OCR Engine Registry, Engine Router
- Priority: P2 (After Registry-Driven Prompts & Schema)
Feature: Cost Tracker Implementation
Description: Implement per-engine cost monitoring and tracking.
- Tasks:
- Design cost tracking data model
- Implement cost tracker in backend/services/cost_tracker.py
- Add cost collection from engine adapters
- Implement cost aggregation and reporting
- Add budget tracking and alerting
- Subtasks:
- Define CostTracker data model
- Create CostTracker class
- Add cost collection from engine adapters (per invocation)
- Implement cost aggregation (total, per engine, per type)
- Add cost reporting (daily, weekly, monthly)
- Add budget tracking and alerting
- Create cost metrics (total_cost_usd, cost_per_request)
- Add cost forecasting based on historical usage
- Implement cost optimization suggestions
- Acceptance Criteria:
- Cost tracker collects costs from engine invocations
- Cost aggregation works (total, per engine, per document type)
- Cost reporting functions (daily, weekly, monthly)
- Budget tracking and alerting implemented
- Cost metrics exposed (total_cost_usd, cost_per_request)
- Cost forecasting based on historical usage
- Cost optimization suggestions provided
- Testing:
- Unit tests for cost tracker (>90% coverage)
- Integration tests verifying cost collection from engines
- Integration tests verifying cost aggregation and reporting
- Budget alerting test
- Cost forecasting test
- Cost optimization suggestions test
- Estimated Complexity: Low
- Dependencies: Tesseract, Donut, Azure Read Engine Adapters
- Priority: P2 (After Registry-Driven Prompts & Schema)
Feature: Circuit Breaker Implementation
Description: Implement circuit breaker pattern per engine for resilience.
- Tasks:
- Design circuit breaker data model and states
- Implement circuit breaker in backend/services/circuit_breaker.py
- Add failure detection and threshold logic
- Implement state transitions (closed → open → half-open → closed)
- Add timeout and recovery mechanisms
- Integrate with engine router for automatic fallback
- Subtasks:
- Define circuit breaker states (closed, open, half-open)
- Create CircuitBreaker class
- Implement failure detection and counting
- Add failure threshold logic for state transitions
- Implement state transition delays and timeouts
- Add half-open state test request logic
- Integrate with engine router for fallback
- Add metrics (state transitions, failure rates)
- Create default threshold configurations
- Acceptance Criteria:
- Circuit breaker implements states (closed, open, half-open)
- Failure detection and threshold logic functional
- State transitions work with timeouts and delays
- Half-open state test request logic implemented
- Integration with engine router for fallback functional
- Metrics collected (state transitions, failure rates)
- Default threshold configurations provided
- Testing:
- Unit tests for circuit breaker (>90% coverage)
- Integration tests verifying state transitions
- Failure detection and threshold tests
- State transition timing tests
- Half-open test request logic test
- Engine router integration test
- Metrics test confirming collection and reporting
- Estimated Complexity: Low
- Dependencies: Tesseract, Donut, Azure Read Engine Adapters
- Priority: P2 (After Registry-Driven Prompts & Schema)
Feature: Engine Integration in OCR Pipeline
Description: Modify OCR pipeline to use engine orchestrator instead of direct engine calls.
- Tasks:
- Update _call_table_excel_anthropic in backend/routers/ocr/_common.py
- Update build_structured_ocr_result in backend/services/ocr_document_pipeline.py
- Replace direct engine calls with engine orchestrator
- Pass document attributes and policies to router
- Handle orchestrator failures and fallbacks
- Subtasks:
- Update _call_table_excel_anthropic to use engine orchestrator
- Get engine selection from router based on document attributes
- Update build_structured_ocr_result similarly
- Add error handling for orchestrator failures
- Implement fallback to legacy direct engine calls
- Add metrics for engine selection and usage
- Update any other pipeline entry points
- Acceptance Criteria:
- OCR pipeline uses engine orchestrator for engine selection
- Engine selection based on document attributes and policies
- Orchestrator failures handled gracefully with fallback
- Metrics collected for engine selection and usage
- No disruption to existing pipeline functionality
- Testing:
- Unit tests for pipeline modifications
- Integration tests verifying engine orchestrator usage
- Integration tests verifying engine selection logic
- Orchestrator failure test
- Fallback test to legacy direct engine calls
- Metrics test confirming engine selection and usage
- Regression test ensuring existing functionality intact
- Estimated Complexity: Medium
- Dependencies: OCREngine Interface, OCR Engine Registry, Engine Router, Engine Adapters
- Priority: P2 (After Registry-Driven Prompts & Schema)
Feature: Engine Orchestrator Feature Flags
Description: Implement feature flags for safe rollout of engine orchestrator.
- Tasks:
- Add feature flag OCR_USE_PLUGGABLE_ENGINES to configuration
- Add per-engine flags (OCR_USE_TESSERACT, OCR_USE_DONUT, OCR_USE_AZURE_READ)
- Wrap engine orchestrator calls with flag check
- Implement legacy fallback when flags disabled
- Create metrics to compare legacy vs new pipeline
- Set defaults to false for safe rollout
- Subtasks:
- Add feature flags to configuration system
- Add per-engine flags for granular control
- Wrap _call_table_excel_anthropic orchestrator call
- Wrap build_structured_ocr_result orchestrator call
- Implement legacy fallback (direct engine calls)
- Add metrics comparison (legacy vs new pipeline)
- Set default values to false
- Create rollback procedure documentation
- Acceptance Criteria:
- Feature flag OCR_USE_PLUGGABLE_ENGINES controls usage
- When false, uses legacy direct engine calls
- When true, uses engine orchestrator
- Per-engine flags allow granular control
- Metrics compare legacy vs new pipeline performance
- Default values are false for safe initial rollout
- Rollback procedure documented
- Testing:
- Unit tests for feature flag wrapping
- Integration tests verifying flag behavior
- Default value tests (false)
- Metrics comparison test
- Rollback procedure test
- Estimated Complexity: Low
- Dependencies: Engine Integration in OCR Pipeline
- Priority: P2 (After Registry-Driven Prompts & Schema)
Phase 4: Advanced Preprocessing & Confidence Calibration
Purpose: Improve OCR accuracy and confidence reliability through modular preprocessing pipeline, engine-specific preprocessing profiles, per-token confidence calibration, and language model rescoring.
Objectives:
- Implement modular preprocessing pipeline with configurable steps (deskew, CLAHE, denoise, background normalization, binarization)
- Create engine-specific preprocessing profiles stored in document registry
- Implement per-token confidence calibration using Platt scaling or isotonic regression per engine
- Add language model rescoring stage for low-confidence tokens to improve accuracy
- Establish confidence quality metrics and calibration validation procedures
Business Value:
- Improves OCR accuracy through optimized preprocessing per document type and engine
- Ensures confidence scores reflect true probability of correctness (well-calibrated)
- Reduces false confidence in OCR outputs through calibration
- Improves accuracy on challenging documents through language model rescoring
- Enables data-driven preprocessing optimization per engine/document type combination
- Provides foundation for confidence-based routing and review workflows
Dependencies: Phase 3 (Pluggable OCR Engine Layer)
Files/Modules Affected:
- backend/services/ocr_preprocessing.py (NEW) - Modular preprocessing pipeline with configurable steps
- backend/services/confidence_calibration.py (NEW) - Per-token confidence calibration (Platt scaling/isotonic regression)
- backend/services/lm_rescorer.py (NEW) - Language model rescoring for low-confidence tokens
- backend/services/document_registry.py - Extended to store preprocessing profiles per engine/document type
- backend/services/ocr_document_pipeline.py - Integrate preprocessing, calibration, and rescoring stages
- backend/services/preprocessing_profile.py (NEW) - Preprocessing profile data model
- backend/services/calibration_data.py (NEW) - Management of calibration data collection and updating
- backend/services/confidence_metrics.py (NEW) - Confidence quality metrics (Brier score, log loss, reliability diagrams)
- frontend/src/lib/confidence-metrics.ts (NEW) - Frontend confidence visualization definitions
Engineering Risks:
- Medium: Over-processing degrading OCR quality - Mitigation: Per-engine/document-type optimization, validation-based tuning
- Medium: Calibration drift over time - Mitigation: Continuous calibration updating with fresh data
- Medium: Language model rescoring latency - Mitigation: Token batching, efficient model serving, confidence-based triggering
- Low: Increased complexity in preprocessing pipeline - Mitigation: Modular design, clear step interfaces, caching
- Low: Data privacy concerns with calibration data - Mitigation: Anonymization, aggregation, retention policies
Testing Strategy:
- Unit tests for each preprocessing step with visual quality validation
- Integration tests verifying correct preprocessing profile application per document type/engine
- Confidence calibration tests measuring Brier score/log loss improvement
- Language model rescoring impact tests on WER/CER for low-confidence tokens
- End-to-end accuracy benchmarks comparing baseline vs enhanced pipeline
- Performance tests measuring preprocessing and rescoring overhead
- Security tests for preprocessing service endpoints
- Data drift detection tests for calibration validity over time
Rollback Strategy:
- Feature Flags: 
- OCR_USE_ADVANCED_PREPROCESS (default: false → true)
- OCR_USE_CONFIDENCE_CALIBRATION (default: false → true)
- OCR_USE_LM_RESCORER (default: false → true)
- Instant Rollback: Disable individual flags to revert to legacy processing stages
- Selective Application: Per-engine/document-type feature flags for granular control
- Data Preservation: Calibration data can be archived but not required for rollback
Success Criteria:
- ≥ 15% relative WER reduction on validated test set
- Confidence scores well-calibrated (reliability diagram close to diagonal, Brier score improved)
- Preprocessing profiles correctly applied per document type and engine
- Language model rescoring provides measurable improvement on low-confidence tokens (<0.6 confidence)
- System maintains or improves processing latency despite additional stages
Acceptance Criteria:
- Preprocessing pipeline applies correct sequence of steps per profile
- Confidence calibration reduces over/under-confidence in scores
- Language model rescoring improves accuracy on low-confidence tokens without degrading high-confidence ones
- Preprocessing profiles stored in registry and retrieved correctly per document type/engine
- Calibration data updated regularly with field-collected samples
- Confidence quality metrics show improvement over baseline
- End-to-end latency increase < 15% for documents requiring full preprocessing pipeline
Definition of Done:
- Modular preprocessing pipeline implemented with configurable steps
- Preprocessing profiles stored in registry and applied per document type/engine
- Confidence calibration implemented per engine with updating mechanism
- Language model rescoring integrated for low-confidence tokens
- Confidence quality metrics implemented and tracked
- Feature flags for each stage implemented
- Unit tests for preprocessing, calibration, and rescoring (>80% coverage each)
- Integration tests verifying correct application per document type/engine
- Performance benchmark showing <15% latency overhead
- Accuracy bench showing ≥15% WER reduction on test set
- Calibration data pipeline validated with sample collection and updating
- Security review completed for preprocessing service endpoints
- Documentation updated for preprocessing, calibration, and rescoring systems
- Knowledge transfer session conducted with backend, ML, and DevOps teams
Feature: Modular Preprocessing Pipeline
Description: Implement modular preprocessing pipeline with configurable steps.
- Tasks:
- Design preprocessing step interface
- Create preprocessing service in backend/services/ocr_preprocessing.py
- Implement standard steps: deskew, CLAHE, denoise, background normalization, binarization
- Add step chaining and configuration
- Implement step caching and reuse
- Subtasks:
- Define preprocessing step interface
- Create PreprocessingService class
- Implement deskew step (Hough lines or projection profile)
- Implement CLAHE step (contrast adaptive histogram equalization)
- Implement denoise step (median blur or non-local means)
- Implement background normalization step (retinex or homomorphic filtering)
- Implement binarization step (Sauvola, Otsu, or adaptive threshold)
- Add step chaining and pipeline execution
- Add preprocessing configuration (enabled steps, order, parameters)
- Implement preprocessing caching (LRU or TTL-based)
- Add step metrics (latency, success rate)
- Acceptance Criteria:
- Preprocessing step interface defined
- All five standard steps implemented
- Step chaining and pipeline execution functional
- Preprocessing configuration supported (enabled steps, order)
- Preprocessing caching improves performance
- Step metrics collected (latency, success rate)
- Testing:
- Unit tests for preprocessing service (>90% coverage)
- Integration tests verifying each step functionality
- Integration tests verifying step chaining and pipeline
- Configuration test for step enabling/disabling and ordering
- Caching test verifying performance improvement
- Step metrics test confirming collection and reporting
- Estimated Complexity: Medium
- Dependencies: Pluggable OCR Engine Layer
- Priority: P3 (After Pluggable OCR Engine Layer)
Feature: Preprocessing Profiles in Registry
Description: Extend document registry to store engine-specific preprocessing profiles.
- Tasks:
- Extend DocumentTypeConfig to include preprocessing_profile field
- Add validation for preprocessing profile references
- Create default preprocessing profiles for each engine
- Map document types to appropriate preprocessing profiles
- Subtasks:
- Extend DocumentTypeConfig with preprocessing_profile field
- Add validation for preprocessing profile references
- Create default Tesseract preprocessing profile
- Create default Donut preprocessing profile
- Create default Azure Read preprocessing profile
- Map existing document types to profiles
- Add validation for profile references in registry
- Implement profile lookup and retrieval
- Acceptance Criteria:
- DocumentTypeConfig includes preprocessing_profile field
- Validation ensures preprocessing profile references exist
- Default profiles created for each engine
- Existing document types mapped to profiles
- Profile validation prevents invalid references
- Profile lookup and retrieval functional
- Testing:
- Unit tests for DocumentTypeConfig extension (>90% coverage)
- Integration tests verifying profile validation
- Default profiles test for each engine
- Mapping test verifying correct document type assignment
- Validation test for profile references
- Profile lookup test
- Estimated Complexity: Low
- Dependencies: Modular Preprocessing Pipeline
- Priority: P3 (After Pluggable OCR Engine Layer)
Feature: Confidence Calibration Implementation
Description: Implement per-token confidence calibration using Platt scaling or isotonic regression.
- Tasks:
- Design confidence calibration data model
- Implement confidence calibration service in backend/services/confidence_calibration.py
- Add Platt scaling and isotonic regression implementations
- Implement calibration data collection and updating
- Add calibration application to OCR tokens
- Subtasks:
- Define ConfidenceCalibration data model
- Create ConfidenceCalibrationService class
- Implement Platt scaling method
- Implement isotonic regression method
- Add calibration data collection from OCR results
- Implement calibration updating procedure
- Add calibration application to OCR tokens/words
- Add calibration metrics (Brier score, log loss, reliability diagram)
- Create default calibration per engine
- Acceptance Criteria:
- Confidence calibration service implemented
- Platt scaling and isotonic regression implemented
- Calibration data collection and updating functional
- Calibration application to OCR tokens/words working
- Calibration metrics collected (Brier score, log loss, reliability)
- Default calibration created for each engine
- Testing:
- Unit tests for confidence calibration service (>90% coverage)
- Integration tests verifying Platt scaling and isotonic regression
- Integration tests verifying data collection and updating
- Integration tests verifying calibration application
- Calibration metrics test confirming collection
- Default calibration test for each engine
- Estimated Complexity: Medium
- Dependencies: Pluggable OCR Engine Layer
- Priority: P3 (After Pluggable OCR Engine Layer)
Feature: Language Model Rescorer Implementation
Description: Implement language model rescoring stage for low-confidence tokens to improve accuracy.
- Tasks:
- Design language model rescoring interface
- Implement LM rescoring service in backend/services/lm_rescorer.py
- Add confidence-based triggering (only rescore tokens below threshold)
- Implement token batching for efficient processing
- Add fallback to original tokens on rescoring failure
- Subtasks:
- Define LMRescorer interface
- Create LMRescorerService class
- Implement confidence-based triggering (rescore if token confidence < 0.6)
- Add token batching (process tokens in batches for efficiency)
- Implement language model loading and inference (small LM like DistilBERT)
- Add rescoring logic (replace token if LM suggests higher probability alternative)
- Implement fallback to original tokens on failure
- Add rescoring metrics (tokens rescored, accuracy improvement)
- Create default configuration (threshold, model, batch size)
- Acceptance Criteria:
- LM rescoring service implemented with confidence-based triggering
- Only tokens below confidence threshold (default 0.6) are rescored
- Token batching improves processing efficiency
- Language model loading and inference functional
- Rescoring logic replaces tokens with higher probability alternatives
- Fallback to original tokens on rescoring failure
- Rescoring metrics collected (tokens processed, accuracy impact)
- Default configuration functional
- Testing:
- Unit tests for LM rescoring service (>90% coverage)
- Integration tests verifying confidence-based triggering
- Integration tests verifying token batching efficiency
- Integration tests verifying language model inference
- Integration tests verifying rescoring logic and fallback
- Metrics test confirming collection and reporting
- Accuracy test showing improvement on low-confidence tokens
- Estimated Complexity: Medium
- Dependencies: Pluggable OCR Engine Layer, Confidence Calibration Implementation
- Priority: P3 (After Pluggable OCR Engine Layer)
Feature: Preprocessing, Calibration, and Rescorer Integration
Description: Integrate preprocessing, confidence calibration, and language model rescoring into OCR pipeline.
- Tasks:
- Update backend/services/ocr_document_pipeline.py to include new stages
- Add preprocessing stage before OCR execution
- Add confidence calibration stage after OCR execution
- Add language model rescoring stage after calibration
- Handle stage failures and fallbacks
- Add metrics for each stage utilization and performance
- Subtasks:
- Update OCR pipeline to call preprocessing service
- Update OCR pipeline to call confidence calibration service
- Update OCR pipeline to call LM rescorer service
- Add error handling for each stage
- Implement fallback to skipping stage on failure
- Add metrics for stage latency and success rate
- Update any other pipeline entry points
- Acceptance Criteria:
- OCR pipeline executes preprocessing before OCR
- OCR pipeline executes confidence calibration after OCR
- OCR pipeline executes LM rescoring after calibration
- Stage failures handled gracefully with fallback to skipping
- Metrics collected for each stage utilization and performance
- No disruption to existing pipeline functionality
- Testing:
- Unit tests for pipeline modifications
- Integration tests verifying stage execution order
- Integration tests verifying stage failure handling
- Fallback test verifying graceful degradation
- Metrics test confirming stage utilization collection
- Regression test ensuring existing functionality intact
- Estimated Complexity: Medium
- Dependencies: Modular Preprocessing Pipeline, Preprocessing Profiles in Registry, Confidence Calibration Implementation, Language Model Rescorer Implementation
- Priority: P3 (After Pluggable OCR Engine Layer)
Feature: Preprocessing, Calibration, and Rescorer Feature Flags
Description: Implement feature flags for safe rollout of preprocessing, calibration, and rescoring stages.
- Tasks:
- Add feature flag OCR_USE_ADVANCED_PREPROCESS to configuration
- Add feature flag OCR_USE_CONFIDENCE_CALIBRATION to configuration
- Add feature flag OCR_USE_LM_RESCORER to configuration
- Wrap each stage call with flag check
- Implement legacy fallback when flags disabled
- Create metrics to compare legacy vs new pipeline
- Set defaults to false for safe rollout
- Subtasks:
- Add feature flags to configuration system
- Wrap preprocessing service call with flag check
- Wrap confidence calibration service call with flag check
- Wrap LM rescorer service call with flag check
- Implement legacy fallback (skip stages)
- Add metrics comparison (legacy vs new pipeline)
- Set default values to false
- Create rollback procedure documentation
- Acceptance Criteria:
- Feature flag OCR_USE_ADVANCED_PREPROCESS controls preprocessing usage
- Feature flag OCR_USE_CONFIDENCE_CALIBRATION controls calibration usage
- Feature flag OCR_USE_LM_RESCORER controls rescoring usage
- When false, skips respective stage (legacy behavior)
- When true, executes respective stage as implemented
- Metrics comparison shows performance impact of each stage
- Default values are false for safe initial rollout
- Rollback procedure documented and tested
- Testing:
- Unit tests for feature flag wrapping (>90% coverage)
- Integration tests verifying flag behavior (on/off)
- Default value test (false)
- Metrics comparison test verifying collection and reporting
- Rollback procedure test verifying graceful degradation
- Regression test ensuring existing functionality intact when flags disabled
- Estimated Complexity: Low
- Dependencies: Modular Preprocessing Pipeline, Preprocessing Profiles in Registry, Confidence Calibration Implementation, Language Model Rescorer Implementation
- Priority: P3 (After Pluggable OCR Engine Layer)
Phase 5: Validation Pipeline & Response Schema
Purpose: Implement comprehensive validation pipeline and enriched OCR response schema to provide actionable feedback and structured output.
Objectives:
- Build multi-stage validation pipeline (structural, schema, business, semantic) with configurable rules
- Define and implement enriched OCR response schema with metadata, confidence scores, validation results, and structural elements
- Integrate validation results into OCR response for client consumption
- Implement field-level validation feedback mechanisms in frontend
- Establish validation quality metrics and continuous improvement procedures
Business Value:
- Provides actionable, field-specific validation feedback to users
- Enables early detection and correction of data errors
- Improves data quality flowing to downstream systems
- Supports compliance requirements through comprehensive validation and audit trails
- Provides foundation for confidence-based review workflows
- Enables structured data exchange with external systems
- Reduces manual data cleaning efforts in downstream processes
Dependencies: Phase 4 (Advanced Preprocessing & Confidence Calibration)
Files/Modules Affected:
- backend/services/validation_pipeline.py (NEW) - Multi-stage validation pipeline (structural, schema, business, semantic)
- backend/models/ocr_result.py (NEW) - Pydantic model for enriched OCR response
- backend/services/ocr_document_pipeline.py - Update response building to use enriched schema
- backend/services/validation_rule.py (EXTENDED) - Enhanced validation rule model with types and enforcement
- backend/services/validation_metrics.py (NEW) - Validation quality metrics and effectiveness tracking
- frontend/src/lib/ocr-types.ts (EXTENDED) - Updated OCR result type definitions
- frontend/src/lib/validation-display.tsx (NEW) - Component for displaying field-level validation feedback
- frontend/src/lib/confidence-display.tsx (NEW) - Component for visualizing field-level confidence scores
- frontend/src/lib/review-workflow.ts (EXTENDED) - Enhanced review workflow with validation feedback integration
- backend/services/document_registry.py - Extended to store validation rules per document type
- backend/services/error_formatter.py (NEW) - Standardized error/warning formatting for clients
Engineering Risks:
- Medium: Validation pipeline becoming bottleneck - Mitigation: Parallelizable stages, early exits, caching of rule evaluations
- Medium: Schema validation rejecting valid outputs due to over-constraining - Mitigation: Gradual rollout, warning-only mode, continuous tuning
- Medium: Increased response size affecting clients - Mitigation: Optional fields, compression, client-side filtering
- Low: Validation rule complexity and maintenance - Mitigation: Registry-driven, versioned rules, automated testing
- Low: Frontend complexity increase - Mitigation: Modular components, progressive disclosure, user testing
Testing Strategy:
- Unit tests for each validation stage (structural, schema, business, semantic)
- Integration tests verifying correct validation rule application per document type
- Validation effectiveness tests measuring error detection and false positive rates
- End-to-end tests verifying validation results in OCR response
- Frontend integration tests for validation display components
- Performance tests measuring validation pipeline overhead
- Security tests for validation service endpoints
- Chaos engineering tests for validation failure scenarios
- Backward compatibility tests with legacy flat response format
Rollback Strategy:
- Feature Flag: OCR_USE_ENRICHED_RESPONSE (default: false → true)
- Gradual Rollout: 
- Phase 1: Internal services use enriched schema, legacy clients receive flattened version
- Phase 2: Gradually route client traffic to enriched response version
- Phase 3: Full cutover to enriched response with legacy client adapter if needed
- Instant Rollback: Disable flag to revert to legacy response format for all clients
- Backward Compatibility: Legacy response flattening service maintains compatibility
- Data Preservation: Enriched schema contains all legacy data plus additional fields
Success Criteria:
- Validation pipeline catches ≥ 90% of known error types in test set
- Enriched response schema adopted by all internal consumers
- Field-level validation feedback visible and actionable in verification UI
- No schema-breaking changes to existing API consumers (backward compatibility maintained)
- Validation quality metrics show improvement over baseline
Acceptance Criteria:
- Multi-stage validation pipeline properly processes documents through all stages
- Enriched OCR result contains all required metadata, confidence scores, validation results, and structural elements
- Field-level validation errors/warnings displayed correctly in frontend with actionable guidance
- Legacy clients receive compatible flattened response when needed
- Validation quality metrics (precision, recall, F1) show improvement over baseline
- Validation pipeline introduces < 10% latency overhead
- Validation rules stored in registry and correctly applied per document type
- Validation metrics pipeline tracks effectiveness and provides improvement suggestions
Definition of Done:
- Multi-stage validation pipeline implemented with structural, schema, business, and semantic stages
- Enriched OCR result Pydantic model defined and implemented
- OCR pipeline updated to build and return enriched response format
- Validation quality metrics implemented and tracked
- Field-level validation feedback components implemented in frontend
- Review workflow enhanced to integrate validation feedback
- Feature flag OCR_USE_ENRICHED_RESPONSE implemented
- Unit tests for validation pipeline (>80% coverage per stage)
- Integration tests verifying correct validation application per document type
- End-to-end tests confirming validation results in OCR response
- Frontend integration tests for validation display components
- Performance benchmark showing <10% latency overhead
- Backward compatibility verified for legacy API consumers
- Security review completed for validation service endpoints
- Documentation updated for validation pipeline, enriched response, and frontend components
- Knowledge transfer session conducted with backend, frontend, and DevOps teams
Feature: Validation Pipeline Implementation
Description: Build multi-stage validation pipeline (structural, schema, business, semantic) with configurable rules.
- Tasks:
- Design validation stage interfaces
- Implement validation pipeline in backend/services/validation_pipeline.py
- Add structural validation stage (row/column consistency, empty cell ratio, alignment)
- Add schema validation stage (JSON schema validation)
- Add business rule validation stage (value ranges, cross-field checks, format validations)
- Add semantic validation stage (anomaly detection, trend analysis, fraud indicators)
- Implement pipeline orchestration with error handling and metrics
- Subtasks:
- Define validation stage interfaces
- Create ValidationPipeline class
- Implement structural validation stage
- Implement schema validation stage (using ajv or similar)
- Implement business rule validation stage
- Implement semantic validation stage
- Add pipeline orchestration logic (stage execution, error propagation)
- Add pipeline metrics (latency per stage, pass/fail rates)
- Create default validation rules for existing document types
- Add validation caching for performance
- Acceptance Criteria:
- Validation pipeline executes stages in order
- Structural validation checks basic OCR integrity
- Schema validation validates against document-type-specific JSON schema
- Business rule validation applies value ranges and cross-field checks
- Semantic validation applies AI/ML-enhanced checks
- Pipeline metrics collected (latency, pass/fail rates)
- Default validation rules created for existing types
- Validation caching improves performance
- Testing:
- Unit tests for validation pipeline (>90% coverage per stage)
- Integration tests verifying stage execution order
- Integration tests verifying each validation stage functionality
- Pipeline metrics test
- Default validation rules test
- Validation caching test
- Estimated Complexity: Medium
- Dependencies: Advanced Preprocessing & Confidence Calibration
- Priority: P4 (After Advanced Preprocessing & Confidence Calibration)
Feature: Enriched OCR Response Schema
Description: Define and implement enriched OCR response schema with metadata, confidence scores, validation results, and structural elements.
- Tasks:
- Design OCR result data model (Pydantic)
- Implement OCR result model in backend/models/ocr_result.py
- Add fields for document info, processing metadata, confidence scores, content blocks, layout analysis, validation, warnings, and export readiness
- Implement serialization/deserialization methods
- Add validation for required fields and constraints
- Subtasks:
- Define OCRResult Pydantic model
- Add document_info field (type, subtype, confidence, variant)
- Add processing_metadata field (engine, version, latency, cost, profile, timestamp, request_id)
- Add confidence_scores field (overall, factual, structural, per_block)
- Add content field with blocks structure (headers, line_items, totals, etc.)
- Add layout_analysis field (detected_type, columns, grouping, rotation, deskew)
- Add validation field (passed, errors, warnings, value_range_violations, cross_field_violations)
- Add warnings field (general processing warnings)
- Add export_ready, review_required, trusted_export fields
- Implement to_dict/from_dict methods
- Add model validation (required fields, constraints)
- Create default OCR result factory
- Acceptance Criteria:
- OCRResult model defined with all required fields
- Document info captures type and confidence
- Processing metadata includes engine, version, latency, cost
- Confidence scores include overall, factual, structural, and per-block
- Content field supports structured blocks (headers, line_items, totals)
- Layout analysis captures structural information
- Validation field captures pass/fail status and field-specific errors
- Warning fields capture general processing warnings
- Export readiness and review flags functional
- Model validation enforces required fields and constraints
- Serialization/deserialization works correctly
- Testing:
- Unit tests for OCRResult model (>90% coverage)
- Integration tests verifying field population from pipeline
- Serialization test verifying round-trip integrity
- Validation test for required fields and constraints
- Default factory test
- Estimated Complexity: Medium
- Dependencies: Validation Pipeline Implementation
- Priority: P4 (After Advanced Preprocessing & Confidence Calibration)
Feature: Response Building Integration
Description: Update OCR pipeline to build and return enriched OCR response format.
- Tasks:
- Update backend/services/ocr_document_pipeline.py to use enriched schema
- Map pipeline outputs to OCRResult fields
- Integrate validation pipeline results into response
- Handle response building errors and fallbacks
- Add metrics for response building performance
- Subtasks:
- Update OCR pipeline to instantiate OCRResult
- Map document classification results to document_info
- Map processing metadata (engine, latency, cost) to processing_metadata
- Map confidence scores to confidence_scores field
- Map OCR content (blocks, items) to content field
- Map layout analysis results to layout_analysis field
- Map validation pipeline results to validation field
- Map general warnings to warnings field
- Set export_ready, review_required, trusted_export flags
- Add error handling for response building failures
- Implement fallback to legacy flat response on failure
- Add metrics for response building performance
- Acceptance Criteria:
- OCR pipeline returns enriched OCRResult instance
- Document info populated from classification results
- Processing metadata includes engine, version, latency, cost
- Confidence scores reflect overall, factual, structural, per-block
- Content field contains structured blocks with field-level data
- Layout analysis populated with structural information
- Validation results integrated from validation pipeline
- General warnings captured
- Export readiness and review flags set correctly
- Response building errors handled with fallback to legacy format
- Metrics collected for response building performance
- Testing:
- Unit tests for response building integration
- Integration tests verifying enriched response generation
- Integration tests verifying field mapping accuracy
- Error handling test for response building failures
- Fallback test to legacy flat response
- Metrics test confirming performance collection
- Regression test ensuring existing pipeline functionality intact
- Estimated Complexity: Medium
- Dependencies: Validation Pipeline Implementation, Enriched OCR Response Schema
- Priority: P4 (After Advanced Preprocessing & Confidence Calibration)
Feature: Validation Service Feature Flags
Description: Implement feature flags for safe rollout of validation pipeline and enriched response.
- Tasks:
- Add feature flag OCR_USE_ENRICHED_RESPONSE to configuration
- Wrap validation pipeline call with flag check
- Wrap enriched response building with flag check
- Implement legacy fallback when flag disabled (flat response)
- Create metrics to compare legacy vs new response
- Set default to false for safe rollout
- Subtasks:
- Add feature flag to configuration system
- Wrap validation pipeline call in OCR pipeline with flag check
- Wrap enriched response building with flag check
- Implement legacy fallback (skip validation, return flat response)
- Add metrics comparison (legacy vs new response)
- Set default value to false
- Create rollback procedure documentation
- Acceptance Criteria:
- Feature flag OCR_USE_ENRICHED_RESPONSE controls usage
- When false, uses legacy validation and flat response
- When true, uses validation pipeline and enriched response
- Metrics compare legacy vs new response (size, latency, client compatibility)
- Default value is false for safe initial rollout
- Rollback procedure documented and tested
- Testing:
- Unit tests for feature flag wrapping (>90% coverage)
- Integration tests verifying flag behavior (on/off)
- Default value test (false)
- Metrics comparison test verifying collection and reporting
- Rollback procedure test verifying graceful degradation
- Regression test ensuring existing functionality intact when flag disabled
- Estimated Complexity: Low
- Dependencies: Validation Pipeline Implementation, Enriched OCR Response Schema, Response Building Integration
- Priority: P4 (After Advanced Preprocessing & Confidence Calibration)
Phase 6: Frontend Adaptive Layout & Review UX
Purpose: Implement intelligent, adaptive user interface that matches document complexity and provides intelligent review workflows.
Objectives:
- Implement data-density adaptive layout (compact/summary/paginated/card) based on document complexity
- Add field-level confidence visualization and hints for intelligent review guidance
- Enhance review workflow with smart navigation, correction suggestions, and change tracking
- Implement export readiness indicators and multiple format options with preview
- Establish accessibility compliance (WCAG 2.1 AA) and responsive design for tablet/desktop use
Business Value:
- Provides optimal user interface for each document complexity level
- Reduces cognitive load by showing complexity only when needed
- Improves review efficiency through confidence-guided navigation and suggestions
- Decreases time to correct errors through intelligent field highlighting
- Increases user satisfaction through adaptive, intuitive interfaces
- Supports accessibility requirements for diverse user base
- Enables mobile/tablet use in factory and warehouse environments
- Reduces training requirements through intuitive, context-aware interfaces
Dependencies: Phase 5 (Validation Pipeline & Response Schema)
Files/Modules Affected:
- frontend/src/lib/layout-strategy.ts (NEW) - Adaptive layout logic based on data density and document type
- frontend/src/lib/confidence-display.tsx (NEW) - Component for visualizing field-level confidence scores
- frontend/src/views/adaptive-table-view.tsx (NEW) - Handles compact/summary/paginated layout modes
- frontend/src/views/card-form-view.tsx (NEW) - Card-style view for low-density forms
- frontend/src/views/sectioned-view.tsx (NEW) - Sectioned view for documents with logical groupings
- frontend/src/views/paginated-table-view.tsx (NEW) - Paginated view with virtual scrolling for large documents
- frontend/src/components/confidence-badge.tsx (NEW) - Component for displaying field-level confidence
- frontend/src/lib/review-workflow.ts (EXTENDED) - Enhanced review workflow with smart navigation and suggestions
- frontend/src/lib/export-manager.ts (NEW) - Component for managing export options and preview
- frontend/src/lib/accessibility-utils.ts (NEW) - Utilities for WCAG 2.1 AA compliance
- frontend/src/lib/responsive-design.ts (NEW) - Responsive design breakpoints and adaptations
- frontend/src/lib/document-type-resolver.ts (EXTENDED) - Enhanced to determine layout mode from OCR result
- frontend/src/styles/ (EXTENDED) - Updated CSS for new components and responsive design
Engineering Risks:
- Medium: Frontend bundle size increase - Mitigation: Code splitting, lazy loading, tree shaking
- Medium: Performance degradation with large documents - Mitigation: Virtual scrolling, skeleton loaders, incremental rendering
- Medium: Complexity in state management - Mitigation: Modular stores, clear separation of concerns
- Low: Accessibility compliance gaps - Mitigation: Automated testing, manual audits, user testing with assistive technologies
- Low: Responsive design breakpoints not optimal - Mitigation: Data-driven breakpoint selection, user testing
Testing Strategy:
- Unit tests for layout strategy logic with various document complexity scenarios
- Integration tests verifying correct layout mode selection per document type
- Component tests for all new UI components (confidence display, adaptive views, etc.)
- End-to-end tests verifying adaptive layout selection and rendering
- Performance tests with large documents (1000+ rows) measuring render time and memory usage
- Accessibility testing (axe-core, manual testing with screen readers)
- Responsive design testing across device breakpoints
- User acceptance testing with factory and warehouse users
- Security testing for XSS vulnerabilities in dynamic content rendering
- Chaos engineering tests for frontend resilience during backend failures
Rollback Strategy:
- Feature Flags (per layout mode):
- OCR_USE_CARD_VIEW (default: false → true)
- OCR_USE_COMPACT_TABLE (default: false → true)
- OCR_USE_SECTIONED_TABLE (default: false → true)
- OCR_USE_PAGINATED_TABLE (default: false → true)
- Gradual Rollout: 
- Route percentage of document types to new layout modes
- Monitor user satisfaction and task completion metrics
- Gradually increase adoption based on feedback
- Instant Rollback: Disable flags to revert to legacy generic table view
- Backward Compatibility: Legacy generic table view maintained as fallback option
- Data Preservation: No changes to data structures required for rollback
Success Criteria:
- All document types use appropriate layout mode based on complexity and type
- Field-level confidence visualization implemented and actionable
- Review workflow enhancements (smart navigation, suggestions, change tracking) functional
- Export options working with preview functionality
- Accessibility compliance achieved (WCAG 2.1 AA)
- Performance acceptable for 1000+ row documents (< 3s initial render, < 1s interaction latency)
Acceptance Criteria:
- Layout strategy correctly selects mode based on data density (rows×columns) and document type
- Card view used for low-density forms (< 10 fields, no repeating sections)
- Compact table used for simple documents (< 50 cells)
- Sectioned table used for medium complexity documents (50-200 cells)
- Paginated table used for large documents (> 200 cells) with virtual scrolling
- Field-level confidence visualized with color coding (green ≥0.85, yellow 0.60-0.85, red <0.60)
- Hover tooltips show exact confidence scores and field information
- Review workflow enables jump to next low-confidence field
- AI-powered correction suggestions displayed for uncertain fields
- Change tracking with audit trail and undo/redo functionality
- Export dialog shows preview and supports multiple formats (Excel, PDF, JSON, XML)
- All interactive elements keyboard accessible and screen reader friendly
- Responsive layout adapts to mobile/tablet breakpoints
- User satisfaction scores ≥ 4/5 in acceptance testing
- Task completion time reduced by ≥ 25% vs legacy interface for review tasks
Definition of Done:
- Adaptive layout strategy implemented and integrated
- All four layout modes (card, compact, sectioned, paginated) implemented
- Field-level confidence visualization components implemented
- Review workflow enhanced with smart navigation, suggestions, and change tracking
- Export manager implemented with preview and multiple format options
- Accessibility utilities implemented and verified
- Responsive design breakpoints and adaptations implemented
- Document type resolver enhanced to determine layout mode
- Feature flags for each layout mode implemented
- Unit tests for all new frontend components (>80% coverage each)
- Integration tests verifying correct layout selection per document type
- End-to-end tests confirming adaptive layout and rendering
- Performance tests showing acceptable performance with large documents
- Accessibility audit passes WCAG 2.1 AA standards
- User acceptance testing completed with factory/warehouse users
- Security review completed for new frontend components
- Documentation updated for all new frontend components and features
- Knowledge transfer session conducted with frontend, UX, and product teams
Feature: Frontend Layout Strategy Implementation
Description: Implement frontend layout strategy logic based on data density and document type.
- Tasks:
- Create layout strategy service in frontend/src/lib/layout-strategy.ts
- Add data density calculation (rows × columns, field count)
- Implement layout mode selection logic (compact/summary/paginated/card)
- Add document type-specific overrides
- Implement caching for strategy results
- Subtasks:
- Create LayoutStrategy class
- Implement data density calculation from OCR result
- Add layout mode selection based on density thresholds
- Add document type-specific layout preferences
- Implement layout strategy caching (LRU or TTL-based)
- Add metrics for strategy latency and cache hit rate
- Create default layout strategy configuration
- Add validation for layout mode selection
- Acceptance Criteria:
- Layout strategy calculates data density correctly
- Layout mode selection based on density thresholds
- Document type-specific overrides functional
- Layout strategy caching improves performance
- Metrics collected for latency and cache hit rate
- Default configuration functional
- Validation prevents invalid layout mode selection
- Testing:
- Unit tests for layout strategy (>90% coverage)
- Integration tests verifying data density calculation
- Integration tests verifying layout mode selection
- Integration tests verifying document type overrides
- Caching test verifying performance improvement
- Metrics test confirming collection and reporting
- Validation test for layout mode selection
- Estimated Complexity: Medium
- Dependencies: Validation Pipeline & Response Schema
- Priority: P5 (After Validation Pipeline & Response Schema)
Feature: Adaptive Table View Component
Description: Create adaptive table view component handling compact/summary/paginated/layout modes.
- Tasks:
- Create component in frontend/src/views/adaptive-table-view.tsx
- Implement compact mode (simple editable table)
- Implement summary mode (collapsible sections with summary rows)
- Implement paginated mode (virtual scrolling with header statistics)
- Add loading states and error handling
- Integrate with layout strategy for mode selection
- Subtasks:
- Create AdaptiveTableView component
- Implement compact table mode (editable headers/rows)
- Implement summary table mode (collapsible sections, summary rows)
- Implement paginated table mode (virtual scrolling, header stats)
- Add loading and error states
- Integrate with layout strategy for mode selection
- Add keyboard navigation support
- Add accessibility features (ARIA labels, roles)

- Create default props configuration
- Acceptance Criteria:
- Component renders correctly in compact mode (< 50 cells)
- Component renders correctly in summary mode (50-200 cells)
- Component renders correctly in paginated mode (> 200 cells)
- Loading and error states functional
- Layout strategy integration selects correct mode
- Keyboard navigation works in all modes
- Accessibility features implemented (ARIA, roles)
- Default props configuration functional
- Testing:
- Unit tests for AdaptiveTableView (>80% coverage)
- Integration tests verifying each layout mode
- Integration tests verifying loading and error states
- Integration tests verifying layout strategy integration
- Accessibility test (axe-core) for each mode
- Keyboard navigation test
- Default props test
- Estimated Complexity: Medium
- Dependencies: Frontend Layout Strategy Implementation
- Priority: P5 (After Validation Pipeline & Response Schema)
Feature: Card Form View Component
Description: Create card-style view component for low-density forms.
- Tasks:
- Create component in frontend/src/views/card-form-view.tsx
- Implement form-style layout with field grouping
- Add field-level editing with validation
- Implement section-based organization for complex forms
- Add loading states and error handling
- Subtasks:
- Create CardFormView component
- Implement form-style layout (label-value pairs)
- Add field-level editing with inline validation
- Implement section-based organization (collapsible field groups)
- Add loading and error states
- Integrate with layout strategy for mode selection
- Add keyboard navigation support
- Add accessibility features (ARIA labels, roles)
- Create default props configuration
- Acceptance Criteria:
- Component renders correctly for low-density forms (< 10 fields, no repeating sections)
- Field-level editing with validation functional
- Section-based organization works for complex forms
- Loading and error states functional
- Layout strategy integration selects card mode when appropriate
- Keyboard navigation works
- Accessibility features implemented (ARIA, roles)
- Default props configuration functional
- Testing:
- Unit tests for CardFormView (>80% coverage)
- Integration tests verifying form rendering and editing
- Integration tests verifying section-based organization
- Integration tests verifying loading and error states
- Integration tests verifying layout strategy integration
- Accessibility test (axe-core)
- Keyboard navigation test
- Default props test
- Estimated Complexity: Medium
- Dependencies: Frontend Layout Strategy Implementation
- Priority: P5 (After Validation Pipeline & Response Schema)
Feature: Sectioned View Component
Description: Create sectioned view component for documents with logical groupings.
- Tasks:
- Create component in frontend/src/views/sectioned-view.tsx
- Implement collapsible sections with titles
- Add section-specific layouts (table, form, key-value)
- Implement section expansion/collapsing state
- Add loading states and error handling
- Subtasks:
- Create SectionedView component
- Implement collapsible section UI
- Add section-specific layout rendering
- Implement expansion/collapsing state management
- Add loading and error states
- Integrate with layout strategy for mode selection
- Add keyboard navigation support
- Add accessibility features (ARIA labels, roles)
- Create default props configuration
- Acceptance Criteria:
- Component renders collapsible sections correctly
- Section-specific layouts functional (table, form, key-value)
- Expansion/collapsing state management works
- Loading and error states functional
- Layout strategy integration selects sectioned mode when appropriate
- Keyboard navigation works
- Accessibility features implemented (ARIA, roles)
- Default props configuration functional
- Testing:
- Unit tests for SectionedView (>80% coverage)
- Integration tests verifying section rendering
- Integration tests verifying section-specific layouts
- Integration tests verifying expansion/collapsing
- Integration tests verifying loading and error states
- Integration tests verifying layout strategy integration
- Accessibility test (axe-core)
- Keyboard navigation test
- Default props test
- Estimated Complexity: Medium
- Dependencies: Frontend Layout Strategy Implementation
- Priority: P5 (After Validation Pipeline & Response Schema)
Feature: Paginated Table View Component
Description: Create paginated table view component with virtual scrolling for large documents.
- Tasks:
- Create component in frontend/src/views/paginated-table-view.tsx
- Implement virtual scrolling for large row sets
- Add header statistics (sum, avg, count) for numeric columns
- Implement column freezing and sorting
- Add loading skeletons and error handling
- Implement row selection and batch operations
- Subtasks:
- Create PaginatedTableView component
- Implement virtual scrolling (windowed rendering)
- Add header statistics calculation and display
- Implement column freezing (left columns fixed)
- Implement column sorting (click to sort)
- Add loading skeletons and error handling
- Implement row selection and batch operations (delete, update)
- Integrate with layout strategy for mode selection
- Add keyboard navigation support
- Add accessibility features (ARIA labels, roles)
- Create default props configuration
- Acceptance Criteria:
- Component renders large tables (> 200 cells) with virtual scrolling
- Header statistics displayed and updated correctly
- Column freezing and sorting functional
- Loading skeletons and error handling implemented
- Row selection and batch operations work
- Layout strategy integration selects paginated mode when appropriate
- Keyboard navigation works
- Accessibility features implemented (ARIA, roles)
- Default props configuration functional
- Testing:
- Unit tests for PaginatedTableView (>80% coverage)
- Integration tests verifying virtual scrolling performance
- Integration tests verifying header statistics
- Integration tests verifying column freezing and sorting
- Integration tests verifying loading skeletons and error handling
- Integration tests verifying row selection and batch operations
- Integration tests verifying layout strategy integration
- Accessibility test (axe-core)
- Keyboard navigation test
- Default props test
- Estimated Complexity: Medium
- Dependencies: Frontend Layout Strategy Implementation
- Priority: P5 (After Validation Pipeline & Response Schema)
Feature: Confidence Display Components
Description: Create components for visualizing field-level confidence scores.
- Tasks:
- Create confidence badge component in frontend/src/components/confidence-badge.tsx
- Create confidence display component in frontend/src/lib/confidence-display.tsx
- Implement color coding (green ≥0.85, yellow 0.60-0.85, red <0.60)
- Add hover tooltips with exact scores and field information
- Add optional "show low confidence fields" filter
- Subtasks:
- Create ConfidenceBadge component
- Implement color coding based on score thresholds
- Add hover tooltip with exact score and field info
- Create ConfidenceDisplay component
- Integrate confidence visualization into table/form views
- Add "show low confidence fields" filter functionality
- Add metrics for confidence display usage
- Create default configuration for thresholds and styling
- Acceptance Criteria:
- ConfidenceBadge displays correct color based on score
- Hover tooltip shows exact score and field information
- ConfidenceDisplay integrates confidence visualization into views
- "Show low confidence fields" filter works correctly
- Metrics collected for usage
- Default configuration functional
- Testing:
- Unit tests for confidence components (>90% coverage)
- Integration tests verifying color coding and tooltys
- Integration tests verifying integration into table/form views
- Integration tests verifying low confidence filter
- Metrics test confirming collection and reporting
- Default configuration test
- Estimated Complexity: Low
- Dependencies: Frontend Layout Strategy Implementation
- Priority: P5 (After Validation Pipeline & Response Schema)
Feature: Review Workflow Enhancements
Description: Enhance review workflow with smart navigation, correction suggestions, and change tracking.
- Tasks:
- Update review workflow in frontend/src/lib/review-workflow.ts
- Add smart navigation (jump to next low-confidence field)
- Add AI-powered correction suggestions for uncertain fields
- Implement change tracking with audit trail and undo/redo
- Add review progress indicator
- Subtasks:
- Update review-workflow.ts with smart navigation logic
- Add jump-to-next-low-confidence functionality
- Add AI-powered correction suggestion generation for uncertain fields
- Implement change tracking (audit trail, undo/redo stack)
- Add review progress indicator (percentage completed)
- Add keyboard shortcuts for navigation and suggestions
- Add metrics for review workflow usage
- Create default configuration for navigation and suggestions
- Acceptance Criteria:
- Smart navigation jumps to next field with confidence < 0.6
- AI-powered suggestions displayed for fields with confidence 0.6-0.85
- Change tracking records modifications with user/timestamp
- Undo/redo functionality works correctly
- Review progress indicator updates correctly
- Keyboard shortcuts functional for navigation and suggestions
- Metrics collected for review workflow usage
- Default configuration functional
- Testing:
- Unit tests for review workflow enhancements (>90% coverage)
- Integration tests verifying smart navigation
- Integration tests verifying correction suggestions
- Integration tests verifying change tracking and undo/redo
- Integration tests verifying progress indicator
- Keyboard shortcuts test
- Metrics test confirming collection and reporting
- Default configuration test
- Estimated Complexity: Medium
- Dependencies: Validation Pipeline & Response Schema
- Priority: P5 (After Validation Pipeline & Response Schema)
Feature: Export Manager Implementation
Description: Create component for managing export options and preview.
- Tasks:
- Create export manager in frontend/src/lib/export-manager.ts
- Add support for multiple formats (Excel, PDF, JSON, XML, CSV)
- Implement export preview functionality
- Add format-specific options (sheet names, formatting, etc.)
- Implement download and direct API export options
- Subtasks:
- Create ExportManager class
- Add support for Excel export with formatting
- Add support for PDF export with image overlay
- Add support for JSON/XML export
- Add support for CSV export
- Implement export preview (dialog with format selection)
- Add format-specific options (Excel sheets, PDF layout, etc.)
- Implement download and direct API export options
- Add error handling for export failures
- Add metrics for export usage and performance
- Create default export configuration
- Acceptance Criteria:
- Export manager supports all required formats
- Export preview shows format selection and options
- Format-specific options functional (Excel sheets, PDF layout)
- Download and direct API export options work
- Export failures handled gracefully with error messages
- Metrics collected for export usage and performance
- Default export configuration functional
- Testing:
- Unit tests for export manager (>90% coverage)
- Integration tests verifying each export format
- Integration tests verifying export preview functionality
- Integration tests verifying format-specific options
- Integration tests verifying download and API export
- Integration tests verifying error handling
- Metrics test confirming collection and reporting
- Default configuration test
- Estimated Complexity: Medium
- Dependencies: Validation Pipeline & Response Schema
- Priority: P5 (After Validation Pipeline & Response Schema)
Feature: Frontend Accessibility and Responsiveness
Description: Implement accessibility compliance (WCAG 2.1 AA) and responsive design for tablet/desktop use.
- Tasks:
- Create accessibility utilities in frontend/src/lib/accessibility-utils.ts
- Create responsive design utilities in frontend/src/lib/responsive-design.ts
- Update all frontend components for accessibility and responsiveness
- Add ARIA labels, roles, and keyboard navigation
- Implement responsive breakpoints and adaptations
- Subtasks:
- Create accessibility utilities (focus management, ARIA, color contrast)
- Create responsive design utilities (breakpoints, adaptations)
- Update AdaptiveTableView for accessibility and responsiveness
- Update CardFormView for accessibility and responsiveness
- Update SectionedView for accessibility and responsiveness
- Update PaginatedTableView for accessibility and responsiveness
- Update confidence display components for accessibility
- Update review workflow for accessibility
- Update export manager for accessibility
- Add keyboard navigation to all interactive components
- Implement responsive layout adaptations
- Acceptance Criteria:
- All frontend components accessible (WCAG 2.1 AA)
- Keyboard navigation works throughout the interface
- ARIA labels and roles correctly applied
- Color contrast meets WCAG 2.1 AA standards
- Responsive design adapts to mobile/tablet breakpoints
- Layout and functionality preserved across device sizes
- No accessibility violations in automated testing
- Testing:
- Unit tests for accessibility and responsive utilities
- Integration tests verifying accessibility of all components
- Integration tests verifying responsive design adaptations
- Automated accessibility testing (axe-core, Lighthouse)
- Manual accessibility testing with screen readers
- Responsive design testing across device breakpoints
- Estimated Complexity: Medium
- Dependencies: Validation Pipeline & Response Schema
- Priority: P5 (After Validation Pipeline & Response Schema)
Feature: Frontend Feature Flags
Description: Implement feature flags for safe rollout of frontend adaptive layout and review enhancements.
- Tasks:
- Add feature flags for each layout mode and enhancement
- Wrap frontend component usage with flag checks
- Implement legacy fallback when flags disabled
- Create metrics to compare legacy vs new frontend
- Set defaults to false for safe rollout
- Subtasks:
- Add feature flag OCR_USE_CARD_VIEW to configuration
- Add feature flag OCR_USE_COMPACT_TABLE to configuration
- Add feature flag OCR_USE_SECTIONED_TABLE to configuration
- Add feature flag OCR_USE_PAGINATED_TABLE to configuration
- Add feature flag OCR_USE_CONFIDENCE_DISPLAY to configuration
- Add feature flag OCR_USE_REVIEW_WORKFLOW_ENHANCE to configuration
- Add feature flag OCR_USE_EXPORT_MANAGER to configuration
- Add feature flag OCR_USE_ACCESSIBILITY_RESPONSIVE to configuration
- Wrap component usage with flag checks
- Implement legacy fallback (generic table view)
- Add metrics comparison (legacy vs new frontend)
- Set default values to false
- Create rollback procedure documentation
- Acceptance Criteria:
- Each feature flag controls its respective frontend enhancement
- When false, uses legacy generic table view
- When true, uses respective enhancement
- Metrics compare legacy vs new frontend (usage, performance, satisfaction)
- Default values are false for safe initial rollout
- Rollback procedure documented and tested
- Testing:
- Unit tests for feature flag wrapping (>90% coverage)
- Integration tests verifying flag behavior (on/off)
- Default value tests (false)
- Metrics comparison test verifying collection and reporting
- Rollback procedure test verifying graceful degradation
- Regression test ensuring existing frontend intact when flags disabled
- Estimated Complexity: Low
- Dependencies: All frontend adaptive layout and review enhancements
- Priority: P5 (After Validation Pipeline & Response Schema)
Epic: Scalability & Observability Enhancements
Feature: Worker Pools Implementation
Description: Implement specialized worker pools (CPU-intensive and GPU-intensive) for different processing stages.
- Tasks:
- Create worker pools service in backend/services/worker-pools.py
- Implement CPU-intensive worker pool (pre-flight, validation, Tesseract)
- Implement GPU-intensive worker pool (Donut, TrOCR, vision models)
- Add worker registration, job queuing, and result collection
- Implement worker health monitoring and auto-restart
- Subtasks:
- Create WorkerPoolsService class
- Implement CPU worker pool with job queuing
- Implement GPU worker pool with job queuing
- Add worker registration and deregistration
- Implement job queuing and result collection
- Add worker health monitoring (heartbeat, resource usage)
- Add auto-restart for failed workers
- Add metrics for worker utilization and job latency
- Create default worker pool configuration
- Add configuration for worker counts and job timeouts
- Acceptance Criteria:
- Worker pools service manages CPU and GPU worker pools
- CPU worker pool handles pre-flight, validation, Tesseract OCR
- GPU worker pool handles Donut, TrOCR, vision model inference
- Worker registration and deregistration functional
- Job queuing and result collection work correctly
- Worker health monitoring and auto-restart functional
- Metrics collected for utilization and job latency
- Default configuration functional
- Testing:
- Unit tests for worker pools service (>90% coverage)
- Integration tests verifying CPU and GPU worker pool separation
- Integration tests verifying job queuing and result collection
- Integration tests verifying worker health monitoring
- Integration tests verifying auto-restart functionality
- Metrics test confirming collection and reporting
- Default configuration test
- Estimated Complexity: Medium
- Dependencies: Frontend Adaptive Layout & Review UX
- Priority: P6 (After Frontend Adaptive Layout & Review UX)
Feature: Message Queue Implementation
Description: Implement message queuing system for asynchronous processing and load leveling.
- Tasks:
- Create message queue service in backend/services/message-queue.py
- Implement message producer and consumer interfaces
- Add message persistence and acknowledgment
- Implement dead letter queue for failed messages
- Add message routing and topic support
- Subtasks:
- Create MessageQueueService class
- Implement producer interface (send message)
- Implement consumer interface (receive message)
- Add message persistence (disk or database)
- Implement acknowledgment mechanism
- Add dead letter queue for failed messages
- Add message routing and topic support
- Add metrics for queue depth, message latency, throughput
- Create default message queue configuration
- Add configuration for persistence, acknowledgment, DLQ
- Acceptance Criteria:
- Message queue service implements producer/consumer interfaces
- Message persistence ensures durability
- Acknowledgment mechanism prevents message loss
- Dead letter queue captures failed messages
- Message routing and topic support functional
- Metrics collected for queue depth, latency, throughput
- Default configuration functional
- Testing:
- Unit tests for message queue service (>90% coverage)
- Integration tests verifying producer/consumer interface
- Integration tests verifying message persistence
- Integration tests verifying acknowledgment mechanism
- Integration tests verifying dead letter queue
- Integration tests verifying routing and topic support
- Metrics test confirming collection and reporting
- Default configuration test
- Estimated Complexity: Medium
- Dependencies: Worker Pools Implementation
- Priority: P6 (After Frontend Adaptive Layout & Review UX)
Feature: Redis Cache Implementation
Description: Implement Redis caching layer for OCR results to reduce redundant processing.
- Tasks:
- Create Redis cache service in backend/services/redis-cache.py
- Implement cache key generation (document hash + parameters)
- Add get/set/delete operations with TTL support
- Implement cache warming and invalidation strategies
- Add cache metrics (hit rate, miss rate, latency)
- Subtasks:
- Create RedisCacheService class
- Implement cache key generation (SHA-256 of image + params)
- Add get/set/delete operations with TTL
- Implement cache warming (pre-load frequent documents)
- Add cache invalidation strategies (time-based, event-based)
- Add cache metrics (hit rate, miss rate, average latency)
- Create default Redis cache configuration
- Add configuration for TTL, warming, invalidation
- Acceptance Criteria:
- Redis cache service stores and retrieves OCR results
- Cache key generation uses document hash and parameters
- Get/set/delete operations work with TTL support
- Cache warming and invalidation strategies functional
- Cache metrics collected (hit rate, miss rate, latency)
- Default configuration functional
- Testing:
- Unit tests for Redis cache service (>90% coverage)
- Integration tests verifying cache storage and retrieval
- Integration tests verifying cache key generation
- Integration tests verifying get/set/delete with TTL
- Integration tests verifying cache warming and invalidation
- Metrics test confirming collection and reporting
- Default configuration test
- Estimated Complexity: Medium
- Dependencies: Message Queue Implementation
- Priority: P6 (After Frontend Adaptive Layout & Review UX)
Feature: Autoscaler Implementation
Description: Implement autoscaling policies based on queue depth, latency, and resource metrics.
- Tasks:
- Create autoscaler service in backend/services/autoscaler.py
- Add scaling triggers based on queue depth and latency
- Implement scaling policies with hysteresis and cooldown
- Add integration with worker pools and message queue
- Implement scaling metrics and logging
- Subtasks:
- Create AutoscalerService class
- Add scaling triggers (queue depth > threshold, latency > SLA)
- Implement scaling policies (hysteresis, cooldown periods)
- Add integration with worker pools (scale worker count)
- Add integration with message queue (scale consumer count)
- Add scaling metrics (scale events, resource utilization)
- Create default autoscaler configuration
- Add configuration for thresholds, hysteresis, cooldown
- Acceptance Criteria:
- Autoscaler service triggers scaling based on queue depth and latency
- Scaling policies include hysteresis and cooldown to prevent oscillation
- Integration with worker pools scales worker count correctly
- Integration with message queue scales consumer count correctly
- Scaling metrics collected (events, resource utilization)
- Default configuration functional
- Testing:
- Unit tests for autoscaler service (>90% coverage)
- Integration tests verifying scaling triggers
- Integration tests verifying scaling policies with hysteresis
- Integration tests verifying worker pool scaling
- Integration tests verifying message queue scaling
- Metrics test confirming collection and reporting
- Default configuration test
- Estimated Complexity: Medium
- Dependencies: Redis Cache Implementation
- Priority: P6 (After Frontend Adaptive Layout & Review UX)
Feature: Distributed Tracing Implementation
Description: Implement distributed tracing (OpenTelemetry/Jaeger) for end-to- visibility.
- Tasks:
- Create tracing service in backend/services/tracing.py
- Implement trace ID propagation across service boundaries
- Add span creation for key processing stages
- Implement trace export to Jaeger or similar backend
- Add trace sampling and filtering
- Subtasks:
- Create TracingService class
- Implement trace ID propagation (headers or context)
- Add span creation for ingestion, classification, OCR, validation
- Implement trace export to Jaeger/OTEL collector
- Add trace sampling (probabilistic or rate-based)
- Add trace filtering (exclude sensitive data)
- Add metrics for trace generation and export latency
- Create default tracing configuration
- Add configuration for sampling rate, export endpoint
- Acceptance Criteria:
- Tracing service propagates trace IDs across service boundaries
- Spans created for key processing stages
- Trace export to Jaeger/OTEL collector functional
- Trace sampling and filtering implemented
- Metrics collected for trace generation and export latency
- Default configuration functional
- Testing:
- Unit tests for tracing service (>90% coverage)
- Integration tests verifying trace ID propagation
- Integration tests verifying span creation for stages
- Integration tests verifying trace export functionality
- Integration tests verifying trace sampling and filtering
- Metrics test confirming collection and reporting
- Default configuration test
- Estimated Complexity: Medium
- Dependencies: Autoscaler Implementation
- Priority: P6 (After Frontend Adaptive Layout & Review UX)
Feature: Health Checks and Load Balancing
Description: Enhance health checks and implement load balancing across worker pool instances.
- Tasks:
- Update health check service in backend/services/health-checks.py
- Add health checks for worker pools, message queue, Redis cache
- Implement load balancer service in backend/services/load-balancer.py
- Add round-robin or least-connections load balancing
- Add health check integration with load balancer
- Subtasks:
- Update health check service with worker pool checks
- Update health check service with message queue checks
- Update health check service with Redis cache checks
- Create LoadBalancerService class
- Implement round-robin load balancing
- Implement least-connections load balancing
- Add health check integration (remove unhealthy instances)
- Add metrics for request distribution and latency
- Create default load balancer configuration
- Add configuration for algorithm, health check interval
- Acceptance Criteria:
- Health checks cover worker pools, message queue, Redis cache
- Load balancer distributes requests across instances
- Load balancer integrates with health checks (removes unhealthy)
- Request distribution and latency metrics collected
- Default configuration functional
- Testing:
- Unit tests for health checks and load balancer (>90% coverage)
- Integration tests verifying health checks for all services
- Integration tests verifying load balancer distribution
- Integration tests verifying health check integration
- Metrics test confirming collection and reporting
- Default configuration test
- Estimated Complexity: Low
- Dependencies: Distributed Tracing Implementation
- Priority: P6 (After Frontend Adaptive Layout & Review UX)
Feature: Failure Detection and Failover
Description: Implement failure detection and automatic failover mechanisms for scaled services.
- Tasks:
- Create failure detector service in backend/services/failure-detector.py
- Add failure detection based on health checks and timeouts
- Implement automatic failover to healthy instances
- Add split-brain prevention and recovery mechanisms
- Implement failure metrics and logging
- Subtasks:
- Create FailureDetectorService class
- Add failure detection (health check failures, timeouts)
- Implement automatic failover to healthy instances
- Add split-brain prevention (quorum, consensus)
- Add recovery mechanisms (rehydration, state transfer)
- Add failure metrics (detection latency, failover time)
- Create default failure detector configuration
- Add configuration for detection thresholds, timeouts
- Acceptance Criteria:
- Failure detector service detects instance failures
- Automatic failover to healthy instances functional
- Split-brain prevention mechanisms implemented
- Recovery mechanisms work correctly
- Failure metrics collected (detection latency, failover time)
- Default configuration functional
- Testing:
- Unit tests for failure detector service (>90% coverage)
- Integration tests verifying failure detection
- Integration tests verifying automatic failover
- Integration tests verifying split-brain prevention
- Integration tests verifying recovery mechanisms
- Metrics test confirming collection and reporting
- Default configuration test
- Estimated Complexity: Medium
- Dependencies: Health Checks and Load Balancing
- Priority: P6 (After Frontend Adaptive Layout & Review UX)
Feature: Scalability Feature Flags
Description: Implement feature flags for safe rollout of scalability and observability enhancements.
- Tasks:
- Add feature flags for each scalability component
- Wrap service usage with flag checks
- Implement legacy fallback when flags disabled
- Create metrics to compare legacy vs new scalability
- Set defaults to false for safe rollout
- Subtasks:
- Add feature flag OCR_USE_WORKER_POOLS to configuration
- Add feature flag OCR_USE_MESSAGE_QUEUE to configuration
- Add feature flag OCR_USE_REDIS_CACHE to configuration
- Add feature flag OCR_USE_AUTOSCALER to configuration
- Add feature flag OCR_USE_TRACING to configuration
- Add feature flag OCR_USE_HEALTH_CHECKS to configuration
- Add feature flag OCR_USE_LOAD_BALANCER to configuration
- Add feature flag OCR_USE_FAILURE_DETECTOR to configuration
- Wrap service usage with flag checks
- Implement legacy fallback (monolithic, synchronous processing)
- Add metrics comparison (legacy vs new scalability)
- Set default values to false
- Create rollback procedure documentation
- Acceptance Criteria:
- Each feature flag controls its respective scalability component
- When false, uses legacy monolithic processing
- When true, uses respective scalability enhancement
- Metrics compare legacy vs new scalability (performance, resource usage, reliability)
- Default values are false for safe initial rollout
- Rollback procedure documented and tested
- Testing:
- Unit tests for feature flag wrapping (>90% coverage)
- Integration tests verifying flag behavior (on/off)
- Default value tests (false)
- Metrics comparison test verifying collection and reporting
- Rollback procedure test verifying graceful degradation
- Regression test ensuring existing functionality intact when flags disabled
- Estimated Complexity: Low
- Dependencies: All scalability and observability enhancements
- Priority: P6 (After Frontend Adaptive Layout & Review UX)
Epic: Security, Compliance & Cost Management
Feature: Encryption Implementation
Description: Implement encryption for data at rest (AES-256-GCM) and in transit (TLS 1.3).
- Tasks:
- Create encryption service in backend/services/encryption.py
- Implement AES-256-GCM encryption for data at rest
- Implement TLS 1.3 enforcement for external service communications
- Add key management integration
- Add encryption/decryption performance metrics
- Subtasks:
- Create EncryptionService class
- Implement AES-256-GCM encryption and decryption
- Enforce TLS 1.3 for all external HTTP requests
- Add key management service integration (Vault/KMS)
- Add encryption/decryption latency and throughput metrics
- Create default encryption configuration
- Add configuration for key management, algorithm
- Acceptance Criteria:
- Encryption service implements AES-256-GCM encryption/decryption
- All external service communications use TLS 1.3
- Key management service integration functional
- Encryption/decryption metrics collected (latency, throughput)
- Default configuration functional
- Testing:
- Unit tests for encryption service (>90% coverage)
- Integration tests verifying AES-256-GCM encryption/decryption
- Integration tests verifying TLS 1.3 enforcement
- Integration tests verifying key management integration
- Performance test verifying encryption/decryption overhead
- Default configuration test
- Estimated Complexity: Medium
- Dependencies: Scalability & Observability Enhancements
- Priority: P7 (After Scalability & Observability Enhancements)
Feature: Data Retention and Deletion Implementation
Description: Implement data retention policies and automated deletion workflows.
- Tasks:
- Create data retention service in backend/services/data-retention.py
- Add configurable retention periods per document type
- Implement automated deletion workflows with verification
- Add secure deletion with cryptographic erasure
- Add retention metrics and logging
- Subtasks:
- Create DataRetentionService class
- Add retention period configuration per document type
- Implement automated deletion workflows (scheduled jobs)
- Add secure deletion (cryptographic erasure, verified overwrite)
- Add retention metrics (deleted count, storage freed)
- Create default data retention configuration
- Add configuration for retention periods, deletion schedule
- Acceptance Criteria:
- Data retention service stores retention periods per type
- Automated deletion workflows trigger on schedule
- Secure deletion with verification implemented
- Retention metrics collected (deleted count, storage freed)
- Default configuration functional
- Testing:
- Unit tests for data retention service (>90% coverage)
- Integration tests verifying retention period configuration
- Integration tests verifying automated deletion workflows
- Integration tests verifying secure deletion with verification
- Metrics test confirming collection and reporting
- Default configuration test
- Estimated Complexity: Medium
- Dependencies: Encryption Implementation
- Priority: P7 (After Scalability & Observability Enhancements)
Feature: Access Control Implementation
Description: Implement fine-grained access controls (RBAC/ABAC) for data and operations.
- Tasks:
- Create access control service in backend/services/access-control.py
- Implement role-based access control (RBAC)
- Implement attribute-based access control (ABAC)
- Add policy decision point and policy enforcement point
- Add access control metrics and logging
- Subtasks:
- Create AccessControlService class
- Implement RBAC (roles, permissions, role assignment)
- Implement ABAC (attributes, policies, decision logic)
- Add policy decision point (evaluates access requests)
- Add policy enforcement point (enforces access decisions)
- Add access control metrics (grant/deny rates, latency)
- Create default access control configuration
- Add configuration for roles, attributes, policies
- Acceptance Criteria:
- Access control service implements RBAC and ABAC
- Policy decision point evaluates access requests correctly
- Policy enforcement point enforces access decisions
- Access control metrics collected (grant/deny rates, latency)
- Default configuration functional
- Testing:
- Unit tests for access control service (>90% coverage)
- Integration tests verifying RBAC and ABAC functionality
- Integration tests verifying policy decision and enforcement
- Metrics test confirming collection and reporting
- Default configuration test
- Estimated Complexity: Medium
- Dependencies: Data Retention and Deletion Implementation
- Priority: P7 (After Scalability & Observability Enhancements)
Feature: Cost Monitor Implementation
Description: Implement real-time cost monitoring and budget alerts.
- Tasks:
- Create cost monitor service in backend/services/cost-monitor.py
- Add cost collection from external service invocations
- Implement cost aggregation and reporting (daily, weekly, monthly)
- Add budget tracking and alerting with predictive forecasting
- Add cost optimization suggestions
- Subtasks:
- Create CostMonitorService class
- Add cost collection from OCR engine invocations
- Implement cost aggregation (total, per engine, per type)
- Add cost reporting (daily, weekly, monthly summaries)
- Add budget tracking and alerting (thresholds, forecasts)
- Add cost optimization suggestions (engine switching, preprocessing)
- Create default cost monitor configuration
- Add configuration for collection, reporting, budget thresholds
- Acceptance Criteria:
- Cost monitor service collects costs from external invocations
- Cost aggregation works (total, per engine, per document type)
- Cost reporting functions (daily, weekly, monthly)
- Budget tracking and alerting implemented (thresholds, forecasts)
- Cost optimization suggestions provided
- Default configuration functional
- Testing:
- Unit tests for cost monitor service (>90% coverage)
- Integration tests verifying cost collection from engines
- Integration tests verifying cost aggregation and reporting
- Integration tests verifying budget tracking and alerting
- Integration tests verifying cost optimization suggestions
- Metrics test confirming collection and reporting
- Default configuration test
- Estimated Complexity: Medium
- Dependencies: Access Control Implementation
- Priority: P7 (After Scalability & Observability Enhancements)
Feature: Compliance Implementation
Description: Implement GDPR/CCPA compliance features (data export, deletion, consent management).
- Tasks:
- Create compliance service in backend/services/compliance.py
- Add GDPR data export functionality (portable format)
- Add GDPR deletion functionality (right to be forgotten)
- Add consent management for data processing
- Add compliance reporting and audit trails
- Subtasks:
- Create ComplianceService class
- Add GDPR data export (structured JSON with all personal data)
- Add GDPR deletion (complete removal of personal data)
- Add consent management (tracking, withdrawal, logging)
- Add compliance reporting (export, deletion, consent logs)
- Create default compliance configuration
- Add configuration for export formats, deletion verification
- Acceptance Criteria:
- Compliance service implements GDPR data export
- Compliance service implements GDPR deletion
- Compliance service implements consent management
- Compliance reporting captures export, deletion, consent events
- Default configuration functional
- Testing:
- Unit tests for compliance service (>90% coverage)
- Integration tests verifying GDPR data export
- Integration tests verifying GDPR deletion
- Integration tests verifying consent management
- Metrics test confirming collection and reporting
- Default configuration test
- Estimated Complexity: Medium
- Dependencies: Cost Monitor Implementation
- Priority: P7 (After Scalability & Observability Enhancements)
Feature: Audit Logger Implementation
Description: Implement comprehensive, immutable audit logging.
- Tasks:
- Create audit logger service in backend/services/audit-logger.py
- Implement append-only log storage (immutable)
- Add structured logging for all key events
- Add log integrity verification (hash chains, signatures)
- Add log retention and archiving policies
- Subtasks:
- Create AuditLoggerService class
- Implement append-only log storage (write-once storage)
- Add structured logging for key events (access, modification, export)
- Add log integrity verification (hash chains or digital signatures)
- Add log retention and archiving policies
- Create default audit logger configuration
- Add configuration for storage backend, integrity method
- Acceptance Criteria:
- Audit logger service implements append-only storage
- Structured logging for all key events (access, modification, export)
- Log integrity verification implemented (hash chains or signatures)
- Log retention and archiving policies functional
- Default configuration functional
- Testing:
- Unit tests for audit logger service (>90% coverage)
- Integration tests verifying append-only storage
- Integration tests verifying structured logging for events
- Integration tests verifying log integrity verification
- Integration tests verifying retention and archiving policies
- Default configuration test
- Estimated Complexity: Medium
- Dependencies: Compliance Implementation
- Priority: P7 (After Scalability & Observability Enhancements)
Feature: Security and Compliance Feature Flags
Description: Implement feature flags for safe rollout of security and compliance components.
- Tasks:
- Add feature flags for each security/compliance component
- Wrap service usage with flag checks
- Implement legacy fallback when flags disabled
- Create metrics to compare legacy vs new security/compliance
- Set defaults to false for safe rollout
- Subtasks:
- Add feature flag OCR_USE_ENCRYPTION to configuration
- Add feature flag OCR_USE_DATA_RETENTION to configuration
- Add feature flag OCR_USE_ACCESS_CONTROL to configuration
- Add feature flag OCR_USE_COST_MONITOR to configuration
- Add feature flag OCR_USE_COMPLIANCE to configuration
- Add feature flag OCR_USE_AUDIT_LOGGER to configuration
- Add feature flag OCR_USE_KEY_MANAGER to configuration
- Add feature flag OCR_USE_DATA_CLASSIFIER to configuration
- Add feature flag OCR_USE_CONSENT_MANAGER to configuration
- Add feature flag OCR_USE_SECURE_DELETE to configuration
- Wrap service usage with flag checks
- Implement legacy fallback (unencrypted, no access control, minimal compliance)
- Add metrics comparison (legacy vs new security/compliance)
- Set default values to false
- Create rollback procedure documentation
- Acceptance Criteria:
- Each feature flag controls its respective security/compliance component
- When false, uses legacy minimal security/compliance
- When true, uses respective security/compliance enhancement
- 0 compare legacy vs new security/compliance (incidents, compliance score, cost)
- Default values are false for safe initial rollout
- Rollback procedure documented and tested
- Testing:
- Unit tests for feature flag wrapping (>90% coverage)
- Integration tests verifying flag behavior (on/off)
- Default value tests (false)
- Metrics comparison test verifying collection and reporting
- Rollback procedure test verifying graceful degradation
- Regression test ensuring existing functionality intact when flags disabled
- Estimated Complexity: Low
- Dependencies: All security and compliance components
- Priority: P7 (After Scalability & Observability Enhancements)
Epic: Continuous Learning & Optimization
Feature: Feedback Collector Implementation
Description: Implement mechanism for collecting user corrections and reviews.
- Tasks:
- Create feedback collector service in backend/services/feedback-collector.py
- Add endpoints for submitting corrections and reviews
- Implement feedback validation and preprocessing
- Add feedback storage with metadata (timestamp, user, context)
- Add feedback metrics and logging
- Subtasks:
- Create FeedbackCollectorService class
- Add endpoints for feedback submission (corrections, reviews)
- Add feedback validation (format, completeness)
- Implement feedback preprocessing (anonymization, normalization)
- Add feedback storage with metadata (timestamp, user_id, doc_id)
- Add feedback metrics (submission rate, correction rate)
- Create default feedback collector configuration
- Add configuration for validation, storage, retention
- Acceptance Criteria:
- Feedback collector service accepts corrections and reviews
- Feedback validation and preprocessing functional
- Feedback storage with metadata works correctly
- Feedback metrics collected (submission rate, correction rate)
- Default configuration functional
- Testing:
- Unit tests for feedback collector service (>90% coverage)
- Integration tests verifying feedback submission endpoints
- Integration tests verifying feedback validation and preprocessing
- Integration tests verifying feedback storage and metadata
- Metrics test confirming collection and reporting
- Default configuration test
- Estimated Complexity: Medium
- Dependencies: Security, Compliance & Cost Management
- Priority: P8 (After Security, Compliance & Cost Management)
Feature: Active Learning Implementation
Description: Implement active learning for uncertain predictions to reduce annotation effort.
- Tasks:
- Create active learning service in backend/services/active-learning.py
- Add uncertainty sampling (entropy, least confidence, margin sampling)
- Implement exploration-exploitation balance
- Add integration with feedback collector and labeling queue
- Add active learning metrics and logging
- Subtasks:
- Create ActiveLearningService class
- Add uncertainty sampling methods (entropy, least confidence)
- Implement exploration-exploitation balance (epsilon-greedy)
- Add integration with feedback collector (uncertain samples)
- Add integration with labeling queue (feed samples to labeling)
- Add active learning metrics (uncertainty reduction, label efficiency)
- Create default active learning configuration
- Add configuration for sampling method, exploration rate
- Acceptance Criteria:
- Active learning service implements uncertainty sampling
- Exploration-exploitation balance implemented
- Integration with feedback collector for uncertain samples
- Integration with labeling queue (feed samples to labeling)
- Active learning metrics collected (uncertainty reduction, label efficiency)
- Default configuration functional
- Testing:
- Unit tests for active learning service (>90% coverage)
- Integration tests verifying uncertainty sampling methods
- Integration tests verifying exploration-exploitation balance
- Integration tests verifying feedback collector integration
- Integration tests verifying labeling queue integration
- Metrics test confirming collection and reporting
- Default configuration test
- Estimated Complexity: Medium
- Dependencies: Feedback Collector Implementation
- Priority: P8 (After Security, Compliance & Cost Management)
Feature: Model Retraining Pipeline Implementation
Description: Create model retraining pipeline with validation for continuous improvement.
- Tasks:
- Create model retraining pipeline in backend/services/retraining-pipeline.py
- Add model versioning and storage
- Implement training job orchestration
- Add validation against holdout set and comparison to baseline
- Add model promotion and rollback mechanisms
- Subtasks:
- Create RetrainingPipelineService class
- Add model versioning and storage (registry or model store)
- Implement training job orchestration (start, monitor, complete)
- Add validation against holdout set and comparison to baseline
- Add model promotion (staging → production) and rollback mechanisms
- Add retraining metrics (training time, validation accuracy)
- Create default retraining pipeline configuration
- Add configuration for training data, validation split, promotion criteria
- Acceptance Criteria:
- Model retraining pipeline manages model versioning and storage
- Training job orchestration functional (start, monitor, complete)
- Validation against holdout set and comparison to baseline works
- Model promotion and rollback mechanisms functional
- Retraining metrics collected (training time, validation accuracy)
- Default configuration functional
- Testing:
- Unit tests for retraining pipeline service (>90% coverage)
- Integration tests verifying model versioning and storage
- Integration tests verifying training job orchestration
- Integration tests verifying validation and comparison to baseline
- Integration tests verifying model promotion and rollback
- Metrics test confirming collection and reporting
- Default configuration test
- Estimated Complexity: Medium
- Dependencies: Active Learning Implementation
- Priority: P8 (After Security, Compliance & Cost Management)
Feature: Experiment Framework Implementation
Description: Implement A/B testing framework for features, prompts, and configuration.
- Tasks:
- Create experiment framework service in backend/services/experiment-framework.py
- Add traffic splitting and variant routing and sample splitting mechanisms
- Implement statistical significance testing
- Add experiment tracking and reporting
- Add experiment lifecycle management (start, monitor, stop)
- Subtasks:
- Create ExperimentFrameworkService class
- Add traffic splitting (HTTP requests, OCR processing)
- Add sample splitting (feedback, labeling, training samples)
- Implement statistical significance testing (t-test, chi-square)
- Add experiment tracking and reporting (start/end dates, metrics)
- Add experiment lifecycle management (start, monitor, stop)
- Create default experiment framework configuration
- Add configuration for splitting method, significance threshold
- Acceptance Criteria:
- Experiment framework service implements traffic and sample splitting
- Statistical significance testing implemented
- Experiment tracking and reporting functional
- Experiment lifecycle management (start, monitor, stop) works
- Default configuration functional
- Testing:
- Unit tests for experiment framework service (>90% coverage)
- Integration tests verifying traffic and sample splitting
- Integration tests verifying statistical significance testing
- Integration tests verifying experiment tracking and reporting
- Integration tests verifying experiment lifecycle management
- Metrics test confirming collection and reporting
- Default configuration test
- Estimated Complexity: Medium
- Dependencies: Model Retraining Pipeline Implementation
- Priority: P8 (After Security, Compliance & Cost Management)
Feature: Drift Detector Implementation
Description: Implement drift detection for accuracy, latency, and other key metrics.
- Tasks:
- Create drift detector service in backend/services/drift-detector.py
- Add multiple drift detection methods (EWM, CUSUM, threshold)
- Implement confirmation windows to reduce false positives
- Add drift alerting and notification mechanisms
- Add drift metrics and logging
- Subtasks:
- Create DriftDetectorService class
- Add EWM (Exponentially Weighted Moving) average method
- Add CUSUM (Cumulative Sum) control chart method
- Add threshold-based drift detection method
- Add confirmation windows (require drift over multiple windows)
- Add drift alerting (email, Slack, PagerDuty)
- Add drift metrics (drift rate, confirmation rate)
- Create default drift detector configuration
- Add configuration for detection methods, window sizes, thresholds
- Acceptance Criteria:
- Drift detector service implements multiple detection methods
- Confirmation windows reduce false positives
- Drift alerting and notification mechanisms functional
- Drift metrics collected (drift rate, confirmation rate)
- Default configuration functional
- Testing:
- Unit tests for drift detector service (>90% coverage)
- Integration tests verifying drift detection methods
- Integration tests verifying confirmation windows
- Integration tests verifying drift alerting and notification
- Metrics test confirming collection and reporting
- Default configuration test
- Estimated Complexity: Medium
- Dependencies: Experiment Framework Implementation
- Priority: P8 (After Security, Compliance & Cost Management)
Feature: Model Registry Implementation
Description: Implement model versioning, storage, and rollback capabilities.
- Tasks:
- Create model repository service in backend/services/model-registry.py
- Add model storage with versioning (semantic or build numbers)
- Implement model loading and hot swapping
- Add model metadata storage (accuracy, latency, training data)
- Add model promotion and rollback mechanisms
- Subtasks:
- Create ModelRegistryService class
- Add model storage with versioning
- Implement model loading and hot swapping (zero-downtime)
- Add model metadata storage (accuracy, latency, training data)
- Add model promotion (staging → production) and rollback mechanisms
- Add model registry metrics (hit rate, load latency)
- Create default model repository configuration
- Add configuration for storage backend, versioning scheme
- Acceptance Criteria:
- Model repository service stores models with versioning
- Model loading and hot swapping functional (zero-downtime)
- Model metadata storage works correctly
- Model promotion and rollback mechanisms functional
- Model repository metrics collected (hit rate, load latency)
- Default configuration functional
- Testing:
- Unit tests for model repository service (>90% coverage)
- Integration tests verifying model versioning and storage
- Integration tests verifying model loading and hot swapping
- Integration tests verifying model metadata storage
- Integration tests verifying model promotion and rollback
- Metrics test confirming collection and reporting
- Default configuration test
- Estimated Complexity: Medium
- Dependencies: Drift Detector Implementation
- Priority: P8 (After Security, Compliance & Cost Management)
Feature: Continuous Learning Feature Flags
Description: Implement feature flags for safe rollout of continuous learning components.
- Tasks:
- Add feature flags for each continuous learning component
- Wrap service usage with flag checks
- Implement legacy fallback when flags disabled
- Create metrics to compare legacy vs new learning system
- Set defaults to false for safe rollout
- Subtasks:
- Add feature flag OCR_USE_FEEDBACK_COLLECTOR to configuration
- Add feature flag OCR_USE_ACTIVE_LEARNING to configuration
- Add feature flag OCR_USE_RETRAINING_PIPELINE to configuration
- Add feature flag OCR_USE_EXPERIMENT_FRAMEWORK to configuration
- Add feature flag OCR_USE_DRIFT_DETECTOR to configuration
- Add feature flag OCR_USE_MODEL_REGISTRY to configuration
- Wrap service usage with flag checks
- Implement legacy fallback (static models, no feedback, no experiments)
- Add metrics comparison (legacy vs new learning system)
- Set default values to false
- Create rollback procedure documentation
- Acceptance Criteria:
- Each feature flag controls its respective continuous learning component
- When false, uses legacy static learning system
- When true, respective learning component is enabled
- Metrics compare legacy vs new learning system (accuracy improvement, annotation effort)
- Default values are false for safe initial rollout
- Rollback procedure documented and tested
- Testing:
- Unit tests for feature flag wrapping (>90% coverage)
- Integration tests verifying flag behavior (on/off)
- Default value tests (false)
- Metrics comparison test verifying collection and reporting
- Rollback procedure test verifying graceful degradation
- Regression test ensuring existing functionality intact when flags disabled
- Estimated Complexity: Low
- Dependencies: All continuous learning components
- Priority: P8 (After Security, Compliance & Cost Management)
Epic: Hardening & Documentation
Feature: Security Audit and Penetration Testing
Description: Conduct comprehensive security audit and penetration testing.
- Tasks:
- Schedule and conduct internal security audit
- Schedule and conduct external penetration testing
- Address all critical and high severity findings
- Implement mitigations for medium and low findings as appropriate
- Document all security testing results and remediation
- Subtasks:
- Schedule internal security audit (code review, dependency scan)
- Schedule external penetration testing (OWASP Top 10, API-specific)
- Address critical findings (immediate fixes required)
- Address high severity findings (fix within release cycle)
- Implement mitigations for medium/low findings (accept risk or compensate)
- Document security testing results and remediation actions
- Acceptance Criteria:
- Internal security audit completed with findings documented
- External penetration testing completed with findings documented
- All critical and high severity findings addressed or mitigated
- Medium and low findings appropriately mitigated or accepted with justification
- Security testing results and remediation documented
- Testing:
- Internal security audit findings and remediation
- External penetration testing findings and remediation
- Critical/high findings resolution verification
- Medium/low findings mitigation verification
- Estimated Complexity: Medium
- Dependencies: Continuous Learning & Optimization
- Priority: P9 (After Continuous Learning & Optimization)
Feature: Operational Runbooks and Playbooks
Description: Finalize operational runbooks, playbooks, and incident response procedures.
- Tasks:
- Create operational runbooks for startup, shutdown, backup, recovery
- Create playbooks for specific failure scenarios (worker failure, queue backup)
- Implement incident response procedures and escalation paths
- Add runbook and playbook versioning and review schedule
- Subtasks:
- Create startup and shutdown runbooks
- Create backup and recovery runbooks
- Create worker failure playbook
- Create queue backup playbook
- Create network partitioning playbook
- Create incident response procedures
- Add runbook and playbook versioning
- Add review schedule (quarterly or semi-annual)
- Acceptance Criteria:
- Operational runbooks created for startup, shutdown, backup, recovery
- Playbooks created for specific failure scenarios
- Incident response procedures and escalation paths implemented
- Runbook and playbook versioning implemented
- Review schedule established for operational documentation
- Testing:
- Runbook validation (startup/shutdown procedures)
- Playbook validation (worker failure scenario)
- Playbook validation (queue backup scenario)
- Incident response procedure test
- Versioning and schedule verification
- Estimated Complexity: Low
- Dependencies: Security Audit and Penetration Testing
- Priority: P9 (After Continuous Learning & Optimization)
Feature: API and Integration Documentation
Description: Create comprehensive API and integration documentation.
- Tasks:
- Generate API reference documentation from code annotations
- Create integration guides for major systems (ERP, accounting, inventory)
- Create developer guides for extension and customization points
- Add API versioning and deprecation policies
- Add SDK documentation for supported languages (Python, TypeScript)
- Subtasks:
- Generate API reference from OpenAPI/Swagger annotations
- Create ERP integration guide (SAP, Oracle, Microsoft Dynamics)
- Create accounting system integration guide (QuickBooks, Xero)
- Create inventory system integration guide (WMS, TMS)
- Create developer guide for extension points (engines, validators, UI)
- Add API versioning and deprecation policies
- Create SDK documentation for Python and TypeScript
- Acceptance Criteria:
- API reference documentation generated and comprehensive
- Integration guides created for major systems
- Developer guides created for extension and customization points
- API versioning and deprecation policies implemented
- SDK documentation created for supported languages
- Testing:
- API reference validation (completeness, accuracy)
- Integration guide validation (usability, accuracy)
- Developer guide validation (usability, accuracy)
- SDK documentation validation (completeness, accuracy)
- Estimated Complexity: Medium
- Dependencies: Operational Runbooks and Playbooks
- Priority: P9 (After Continuous Learning & Optimization)
Feature: Performance Optimization Pass
Description: Conduct performance optimization pass to meet all SLAs.
- Tasks:
- Profile system performance under load
- Identify and address performance bottlenecks
- Optimize critical paths (ingestion, classification, OCR, validation)
- Implement caching and precomputation where beneficial
- Add performance regression testing to CI/CD
- Subtasks:
- Profile system under load (100+ documents/minute)
- Identify performance bottlenecks (CPU, GPU, I/O, network)
- Optimize ingestion path (file reading, validation)
- Optimize classification path (feature extraction, model inference)
- Optimize OCR path (engine selection, preprocessing)
- Optimize validation path (rule evaluation, early exits)
- Implement caching and precomputation (frequent documents, rules)
- Add performance regression testing to CI/CD pipeline
- Acceptance Criteria:
- System performance profiled under load
- Performance bottlenecks identified and addressed
- Ingestion path optimized
- Classification path optimized
- OCR path optimized
- Validation path optimized
- Caching and precomputation implemented where beneficial
- Performance regression testing added to CI/CD
- Testing:
- Load testing before and after optimization
- Bottleneck identification and resolution verification
- Path optimization verification (ingestion, classification, OCR, validation)
- Caching and precomputation verification
- Performance regression test in CI/CD
- Estimated Complexity: Medium
- Dependencies: API and Integration Documentation
- Priority: P9 (After Continuous Learning & Optimization)
Feature: Knowledge Transfer and Training
Description: Execute knowledge transfer to operations, support, and product teams.
- Tasks:
- Schedule and conduct knowledge transfer sessions
- Create hands-on labs for common operations and troubleshooting
- Create assessment and feedback mechanisms for knowledge transfer
- Add knowledge transfer materials to internal knowledge base
- Subtasks:
- Schedule knowledge transfer sessions (operations, support, product)
- Create hands-on labs (startup, troubleshooting, backup)
- Create assessment and feedback mechanisms (quizzes, surveys)
- Add knowledge transfer materials to internal knowledge base (Confluence, Notion)
- Add knowledge transfer schedule (regular refreshers)
- Acceptance Criteria:
- Knowledge transfer sessions conducted for all target teams
- Hands-on labs created for common operations and troubleshooting
- Assessment and feedback mechanisms implemented
- Knowledge transfer materials added to internal knowledge base
- Regular knowledge transfer refreshers scheduled
Feature: Knowledge Transfer and Training (continued)
Description: Execute knowledge transfer to operations, support, and product teams.
- Tasks:
- Schedule and conduct knowledge transfer sessions
- Create hands-on labs for common operations and troubleshooting
- Create assessment and feedback mechanisms for knowledge transfer
- Add knowledge transfer materials to internal knowledge base
- Subtasks:
- Schedule knowledge transfer sessions (operations, support, product)
- Create hands-on labs (startup, troubleshooting, backup)
- Create assessment and feedback mechanisms (quizzes, surveys)
- Add knowledge transfer materials to internal knowledge base (Confluence, Notion)
- Add knowledge transfer schedule (regular refreshers)
- Acceptance Criteria:
- Knowledge transfer sessions conducted for all target teams
- Hands-on labs created for common operations and troubleshooting
- Assessment and feedback mechanisms implemented
- Knowledge transfer materials added to internal knowledge base
- Regular knowledge transfer refreshers scheduled
- Testing:
- Knowledge transfer session feedback and assessment
- Hands-on lab validation
- Schedule knowledge transfer sessions (operations, support, product)
- Create hands-on labs (startup, troubleshooting, backup)
- Create assessment and feedback mechanisms (quizzes, surveys)
- Add knowledge transfer materials to internal knowledge base (Confluence, Notion)
- Add knowledge transfer schedule (regular refreshers)
- Acceptance Criteria:
- Knowledge transfer sessions conducted for all target teams
- Hands-on labs created for common operations and troubleshooting
- Assessment and feedback mechanisms implemented
- Knowledge transfer materials added to internal knowledge base
- Regular knowledge transfer refreshers scheduled
- Testing:
- Knowledge transfer session feedback and assessment
- Hands-on lab validation
- Assessment and feedback mechanism validation
- Knowledge base material review
- Session attendance and completion tracking
- Estimated Complexity: Low
- Dependencies: Performance Optimization Pass
- Priority: P9 (After Continuous Learning & Optimization)
This completes the OCR Implementation Backlog document. To summarize what we've created:
1. OCR Target Architecture Bible - Defines what the OCR platform is, its responsibilities, components, communication methods, extensibility, maintainability, and document lifecycle
2. OCR Engineering Master Plan - Breaks down the implementation into 10 phases with clear purposes, objectives, business value, dependencies, files affected, risks, testing strategies, rollback strategies, and success criteria
3. OCR Implementation Backlog - Provides detailed engineering work breakdown with epics, features, tasks, subtasks, acceptance criteria, testing approaches, estimated complexity, dependencies, and priority levels
Together, these three documents form a comprehensive architecture bible and implementation blueprint for transforming the FactoryNerve OCR system into a scalable, enterprise-grade document intelligence platform that can handle the evolving needs of manufacturing operations for the next decade.
The approach is incremental and risk-mitigated, with each phase building on the previous one, feature flags for safe rollouts, clear success criteria, and comprehensive testing strategies at every level. The documentation ensures that future engineering agents can execute this plan without needing to redesign the architecture.