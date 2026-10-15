// Ambiguous shorthand is accepted only in a nearby, explicit subject context.
// A skills list does not disambiguate medical, financial or everyday homonyms.
const softwareContext =
  /\b(?:software|distributed|backend|infrastructure|infra|platforms?|systems?|services?|APIs?|code|engineering|observability|production|data|databases?|unit tests?|integration tests?)\b/i;

const contexts: Record<string, RegExp> = {
  'backend-development': softwareContext,
  'system-reliability': softwareContext,
  'system-performance': softwareContext,
  'system-maintainability': softwareContext,
  'data-consistency': softwareContext,
  'system-latency': softwareContext,
  'system-correctness': softwareContext,
  'software-security': softwareContext,
  'privacy-engineering': softwareContext,
  'software-prototyping': softwareContext,
  'marketplace-systems':
    /\b(?:software|systems?|platform|engineering|backend|infrastructure|infra)\b/i,
  initiative:
    /\b(?:ownership|taking|take|took|show|showed|demonstrat\w*|proactive|self.starter)\b/i,
  espresso: /\b(?:Android|testing|tests?|frameworks?|UI|mobile|Playwright|Cypress|XCUITest)\b/i,
  'software-testing':
    /\b(?:software|code|engineering|observability|automated|unit|integration|concepts?|pyramid|CI\/CD|quality|frameworks?|Playwright|Cypress|Espresso|XCUITest)\b/i,
  r: /\b(?:Python|SQL|SAS|statistics|statistical|programming|language|analysis|analytics|modeling|modelling|RStudio)\b/i,
  swift: /\b(?:iOS|SwiftUI|Objective-C|Xcode|programming|language|framework|mobile|Apple SDK)\b/i,
  spring: /\b(?:Java|Boot|MVC|framework|Hibernate|backend|microservices)\b/i,
  rails: /\b(?:Ruby|web|application|framework|backend|monolith)\b/i,
  flask: /\b(?:Python|Django|FastAPI|web|framework|backend)\b/i,
  hibernate: /\b(?:Java|Spring|ORM|persistence|database|framework)\b/i,
  ray: /\b(?:Python|PyTorch|JAX|ML|AI|framework|distributed|clusters|compute|Kubernetes)\b/i,
  snowflake:
    /\b(?:SQL|dbt|warehouse|warehousing|databases?|pipelines?|platforms?|BigQuery|Redshift|data stack|data architectures?)\b/i,
  iceberg:
    /\b(?:data|tables?|formats?|lakehouse|lake|catalog|metastore|Spark|Flink|Trino|Parquet|S3|GCS|connectors?)\b/i,
  hive: /\b(?:data|SQL|Hadoop|Spark|Presto|Trino|warehouse|queries|tools)\b/i,
  'gcp-storage':
    /\b(?:cloud|storage|Google|GCP|S3|Kafka|BigQuery|buckets?|Dataproc|connectors?|data platforms?)\b/i,
  'aws-s3':
    /\b(?:AWS|Amazon|cloud|storage|data|objects?|buckets?|files?|Kafka|BigQuery|GCS|Iceberg|Parquet|connectors?)\b/i,
  workday:
    /\b(?:HRIS|HCM|Financials|ERP|Procurement|configuration|configuring|configured|systems?|platforms?|integrations?|tools?|NetSuite|ServiceNow|payroll)\b/i,
  greenhouse:
    /\b(?:ATS|applicant|recruiting|recruitment|sourcing|HR|HRIS|platforms?|tools?|systems?|Gem|Goodtime|Workday)\b/i,
  servicenow:
    /\b(?:ITAM|ITSM|configured|configuration|configuring|workflow|integration|platform|tooling|systems?|tools?|Jira|SAP|Workday|NetSuite|Zendesk)\b/i,
  illustrator: /\b(?:Adobe|Photoshop|InDesign|Creative Suite|Creative Cloud|tools?|software)\b/i,
  blender: /\b(?:3D|rendering|render|graphics|animation|DCC|Maya|Houdini|ZBrush|tools?)\b/i,
  maya: /\b(?:Autodesk|3D|modeling|modelling|animation|DCC|Houdini|Substance|ZBrush|tools?)\b/i,
  pinecone: /\b(?:vectors?|databases?|embeddings?|retrieval|Weaviate|Qdrant|pgvector)\b/i,
  llm: /\b(?:models?|language|AI|ML|inference|training|prompting|agents?|generative|fine-tuning|evaluation)\b/i,
  rag: /\b(?:retrieval|generation|LLM|AI|agents?|embeddings?|vectors?|model|architectures?)\b/i,
  tls: /\b(?:security|networking|network|protocols?|HTTPS|SSL|DNS|ingress|traffic|encryption|certificates?|mTLS)\b/i,
  'technical-documentation':
    /\b(?:APIs?|software|developers?|code|platform|architecture|runbooks?|engineering|SDK|pipelines?|connectors?|systems?|technical)\b/i,
  'safe-defaults':
    /\b(?:APIs?|software|configuration|platform|systems?|deployment|developer|rollback|provisioning)\b/i,
  'sales-pipeline':
    /\b(?:sales|CRM|selling|revenue|accounts?|prospects?|forecasting|territory|GTM)\b/i,
  'physical-design':
    /\b(?:RTL|ASIC|chip|chips|silicon|semiconductor|hardware|VLSI|timing|verification|Cadence|Synopsys)\b/i,
  chef: /\b(?:Terraform|Ansible|Puppet|infrastructure|configuration|automation|DevOps|tools?)\b/i,
  puppet: /\b(?:Terraform|Ansible|Chef|infrastructure|configuration|automation|DevOps|tools?)\b/i,
  packer: /\b(?:HashiCorp|Terraform|Ansible|images?|infrastructure|automation|IaC|tools?)\b/i,
  sas: /\b(?:SQL|Python|R|JMP|statistics|statistical|analytics|analysis|programming)\b/i,
  'oracle-database':
    /\b(?:SQL|database|databases|RDBMS|PostgreSQL|MySQL|MariaDB|Hadoop|Teradata)\b/i,
};

const guardedAliases: Record<string, RegExp> = {
  'backend-development': /^backend$/i,
  'system-reliability': /^(?:reliable|reliability)$/i,
  'system-performance': /^(?:performance|performant)$/i,
  'system-maintainability': /^maintainability$/i,
  'data-consistency': /^consistency$/i,
  'system-latency': /^latency$/i,
  'system-correctness': /^correctness$/i,
  'software-security': /^security$/i,
  'privacy-engineering': /^privacy$/i,
  'software-prototyping': /^(?:rapid )?prototyping$/i,
  'marketplace-systems': /^marketplaces$/i,
  initiative: /^initiative$/i,
  'software-testing': /^testing$/i,
  r: /^R$/i,
  spring: /^Spring$/i,
  rails: /^Rails$/i,
  hibernate: /^Hibernate$/i,
  iceberg: /^Iceberg$/i,
  hive: /^Hive$/i,
  'gcp-storage': /^GCS$/i,
  'aws-s3': /^S3$/i,
  illustrator: /^Illustrator$/i,
  maya: /^Maya$/i,
  llm: /^LLMs?$/i,
  rag: /^RAG$/i,
  'technical-documentation': /^documentation$/i,
  'sales-pipeline': /^pipeline management$/i,
  chef: /^Chef$/i,
  'oracle-database': /^Oracle$/i,
  sas: /^SAS$/i,
};

const listSafe = new Set([
  'swift',
  'spring',
  'rails',
  'flask',
  'hibernate',
  'ray',
  'snowflake',
  'workday',
  'greenhouse',
  'servicenow',
  'illustrator',
  'blender',
  'maya',
  'pinecone',
]);

export function corpusAliasAllowed(
  id: string,
  alias: string,
  text: string,
  position: number,
  technicalList: boolean,
) {
  const context = contexts[id];

  if (!context) {
    return true;
  }

  const before =
    text
      .slice(Math.max(0, position - 180), position)
      .split(/[!?;\n]|\.(?=\s|$)/)
      .at(-1) ?? '';

  const after =
    text
      .slice(position + alias.length, position + alias.length + 180)
      .split(/[!?;\n]|\.(?=\s|$)/)[0] ?? '';

  const scope = before + alias + after;

  if (
    id === 'software-testing' &&
    /\b(?:medical|clinical|drug|laboratory|blood|soil) testing\b/i.test(scope) &&
    !/\b(?:software|code|unit|integration)\b/i.test(scope)
  ) {
    return false;
  }

  if (
    id === 'espresso' &&
    /\b(?:served?|coffee|barista|brew(?:ed|ing)?|caf[eé])\b/i.test(scope) &&
    !/\b(?:Android|XCUITest|Playwright|Cypress)\b/i.test(scope)
  ) {
    return false;
  }

  if (id === 'r' && alias === 'R' && /^(?:&D|\/D)/.test(text.slice(position + 1))) {
    return false;
  }

  if (id === 'tls' && alias === 'TLs') {
    return false;
  }

  if (id === 'sas' && alias === 'SAs') {
    return false;
  }

  if (
    id === 'swift' &&
    /\b(?:SWIFT messages|banking|payments|financial institutions|swift execution)\b/i.test(scope)
  ) {
    return false;
  }

  if (id === 'iceberg' && /\btip of (?:the |an )?iceberg\b/i.test(scope)) {
    return false;
  }

  if (id === 'ray' && /ray[ -]tracing/i.test(scope)) {
    return false;
  }

  if (id === 'llm' && /\b(?:Master of Laws|LL\.?M\.? degree|law degree)\b/i.test(scope)) {
    return false;
  }

  // Qualified aliases are already specific. Bare homonyms need subject evidence.
  if (guardedAliases[id] && !guardedAliases[id].test(alias)) {
    return true;
  }

  return context.test(scope) || (technicalList && listSafe.has(id));
}
