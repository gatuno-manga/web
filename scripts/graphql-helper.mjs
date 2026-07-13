import fs from 'node:fs';
import { env } from 'node:process';

/**
 * GraphQL Helper for AI
 *
 * Usage:
 * node scripts/graphql-helper.mjs --summary           # List all queries and mutations
 * node scripts/graphql-helper.mjs --operation <name>  # Show detail for a specific query or mutation
 * node scripts/graphql-helper.mjs --type <name>       # Show schema for a specific GraphQL type
 * node scripts/graphql-helper.mjs --fetch [url]       # Update local graphql.json
 */

const CACHE_FILE = 'graphql.json';
const getBaseUrl = () => {
	let base = env.API_URL || 'http://localhost:3000';
	if (!base.endsWith('/graphql') && !base.endsWith('/graphql/')) {
		base = base.endsWith('/') ? `${base}graphql` : `${base}/graphql`;
	}
	return base;
};

const baseUrl = getBaseUrl();
const DEFAULT_URL = baseUrl;

const INTROSPECTION_QUERY = `
  query IntrospectionQuery {
    __schema {
      queryType { name }
      mutationType { name }
      subscriptionType { name }
      types {
        ...FullType
      }
    }
  }

  fragment FullType on __Type {
    kind
    name
    description
    fields(includeDeprecated: true) {
      name
      description
      args {
        ...InputValue
      }
      type {
        ...TypeRef
      }
      isDeprecated
      deprecationReason
    }
    inputFields {
      ...InputValue
    }
    interfaces {
      ...TypeRef
    }
    enumValues(includeDeprecated: true) {
      name
      description
      isDeprecated
      deprecationReason
    }
    possibleTypes {
      ...TypeRef
    }
  }

  fragment InputValue on __InputValue {
    name
    description
    type {
      ...TypeRef
    }
    defaultValue
  }

  fragment TypeRef on __Type {
    kind
    name
    ofType {
      kind
      name
      ofType {
        kind
        name
        ofType {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                }
              }
            }
          }
        }
      }
    }
  }
`;

async function main() {
	const args = process.argv.slice(2);
	const command = args[0];
	const value = args[1];

	if (command === '--fetch') {
		await fetchGraphQL(value || DEFAULT_URL);
		return;
	}

	if (!fs.existsSync(CACHE_FILE)) {
		console.log('Cache file not found. Fetching from default URL...');
		await fetchGraphQL(DEFAULT_URL);
	}

	if (!fs.existsSync(CACHE_FILE)) {
		return; // failed to fetch
	}

	const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
	const schema = data.data ? data.data.__schema : data.__schema;

	if (!schema) {
		console.error('Invalid GraphQL schema format in cache file.');
		return;
	}

	switch (command) {
		case '--summary':
			printSummary(schema);
			break;
		case '--operation':
			printOperationDetail(schema, value);
			break;
		case '--type':
			printTypeDetail(schema, value);
			break;
		default:
			console.log(
				'Usage: node scripts/graphql-helper.mjs [--summary | --operation <name> | --type <name> | --fetch <url>]',
			);
	}
}

async function fetchGraphQL(url) {
	try {
		console.error(`Fetching from ${url}...`);
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ query: INTROSPECTION_QUERY }),
		});
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		const data = await response.json();
		if (data.errors) {
			console.error(
				'GraphQL Errors:',
				JSON.stringify(data.errors, null, 2),
			);
			process.exit(1);
		}
		fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
		console.error('Saved to graphql.json');
	} catch (e) {
		console.error('Failed to fetch GraphQL schema:', e.message);
		process.exit(1);
	}
}

function getTypeString(typeRef) {
	if (!typeRef) return '';
	if (typeRef.kind === 'NON_NULL') {
		return `${getTypeString(typeRef.ofType)}!`;
	}
	if (typeRef.kind === 'LIST') {
		return `[${getTypeString(typeRef.ofType)}]`;
	}
	return typeRef.name;
}

function printSummary(schema) {
	const queryTypeName = schema.queryType ? schema.queryType.name : 'Query';
	const mutationTypeName = schema.mutationType
		? schema.mutationType.name
		: 'Mutation';

	const queryType = schema.types.find((t) => t.name === queryTypeName);
	const mutationType = schema.types.find((t) => t.name === mutationTypeName);

	console.log('='.repeat(50));
	console.log(' QUERIES');
	console.log('='.repeat(50));
	if (queryType?.fields) {
		for (const field of queryType.fields) {
			const args = field.args
				.map((a) => `${a.name}: ${getTypeString(a.type)}`)
				.join(', ');
			console.log(
				`- ${field.name}${args ? `(${args})` : ''} : ${getTypeString(field.type)}`,
			);
			if (field.description)
				console.log(`    ${field.description.replace(/\n/g, ' ')}`);
		}
	} else {
		console.log('No queries found.');
	}

	console.log(`\n${'='.repeat(50)}`);
	console.log(' MUTATIONS');
	console.log('='.repeat(50));
	if (mutationType?.fields) {
		for (const field of mutationType.fields) {
			const args = field.args
				.map((a) => `${a.name}: ${getTypeString(a.type)}`)
				.join(', ');
			console.log(
				`- ${field.name}${args ? `(${args})` : ''} : ${getTypeString(field.type)}`,
			);
			if (field.description)
				console.log(`    ${field.description.replace(/\n/g, ' ')}`);
		}
	} else {
		console.log('No mutations found.');
	}
}

function printOperationDetail(schema, opName) {
	if (!opName) {
		console.log(
			'Please provide an operation name. Usage: --operation <name>',
		);
		return;
	}
	const queryTypeName = schema.queryType ? schema.queryType.name : 'Query';
	const mutationTypeName = schema.mutationType
		? schema.mutationType.name
		: 'Mutation';

	const queryType = schema.types.find((t) => t.name === queryTypeName);
	const mutationType = schema.types.find((t) => t.name === mutationTypeName);

	const queryField = queryType?.fields?.find((f) => f.name === opName);
	const mutationField = mutationType?.fields?.find((f) => f.name === opName);

	const field = queryField || mutationField;

	if (!field) {
		console.log(`Operation (Query or Mutation) '${opName}' not found.`);
		return;
	}

	console.log(`Type: ${queryField ? 'QUERY' : 'MUTATION'}`);
	console.log(JSON.stringify(field, null, 2));
}

function printTypeDetail(schema, typeName) {
	if (!typeName) {
		console.log('Please provide a type name. Usage: --type <name>');
		return;
	}
	const type = schema.types.find((t) => t.name === typeName);
	if (!type) {
		console.log(`Type '${typeName}' not found.`);
		return;
	}
	console.log(JSON.stringify(type, null, 2));
}

main();
