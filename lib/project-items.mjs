/** The fixed query retrieves item identity, archival/type data, repository binding, and field IDs needed for fail-closed queue selection. */
const query = `query($projectId:ID!,$cursor:String){node(id:$projectId){... on ProjectV2{items(first:100,after:$cursor){nodes{id isArchived type content{__typename ... on Issue{url repository{nameWithOwner}}} fieldValues(first:100){nodes{... on ProjectV2ItemFieldSingleSelectValue{optionId name field{... on ProjectV2SingleSelectField{id name}}}}}} pageInfo{hasNextPage endCursor}}}}}`;

/** Load every Project item through bounded cursor pagination and preserve field identities. */
export async function fetchProjectItems(project, spawn) {
  /** Items preserve server order, IDs prove cross-page uniqueness, and cursor records pagination progress. */
  const items = [];
  const ids = new Set();
  let cursor = '';
  for (let page = 0; page < 100; page += 1) {
    /** Omitting the optional cursor on page one sends GraphQL null rather than an invalid empty cursor. */
    const argv = ['gh', 'api', 'graphql', '-f', `query=${query}`, '-F', `projectId=${project.id}`, ...(cursor === '' ? [] : ['-f', `cursor=${cursor}`])];
    /** Each page outcome remains available for precise failed, invalid, or unknown classification. */
    let outcome;
    try { outcome = await spawn(argv); } catch (error) { return { status: 'unknown', error: { name: error instanceof Error ? error.name : 'Error', message: error instanceof Error ? error.message : String(error) } }; }
    if (!outcome || typeof outcome !== 'object' || !Number.isInteger(outcome.exitCode) || typeof outcome.stdout !== 'string') return { status: 'unknown', diagnostics: ['Project query returned an invalid process outcome'] };
    if (outcome.exitCode !== 0) return { status: 'failed', outcome };
    /** The decoded connection is accepted only with nodes and explicit continuation evidence. */
    let connection;
    try { connection = JSON.parse(outcome.stdout)?.data?.node?.items; } catch {}
    if (!connection || !Array.isArray(connection.nodes) || typeof connection.pageInfo?.hasNextPage !== 'boolean') return { status: 'invalid', diagnostics: ['Project query returned invalid nodes or pageInfo'], outcome };
    for (const node of connection.nodes) {
      if (typeof node?.id !== 'string' || ids.has(node.id)) return { status: 'invalid', diagnostics: ['Project query returned missing or duplicate item IDs'] };
      ids.add(node.id);
      items.push(node);
    }
    if (!connection.pageInfo.hasNextPage) return { status: 'succeeded', items };
    if (typeof connection.pageInfo.endCursor !== 'string' || connection.pageInfo.endCursor === '') return { status: 'invalid', diagnostics: ['Project query omitted the next cursor'] };
    cursor = connection.pageInfo.endCursor;
  }
  return { status: 'invalid', diagnostics: ['Project query exceeded 100 pages'] };
}

/** Resolve one single-select value by immutable field ID. */
export function projectSingleSelect(item, fieldId) {
  /** Only one value for the immutable field ID can authorize status or priority interpretation. */
  const values = item?.fieldValues?.nodes;
  if (!Array.isArray(values)) return undefined;
  /** Duplicate values are rejected rather than selecting an arbitrary display-name match. */
  const matches = values.filter((value) => value?.field?.id === fieldId);
  return matches.length === 1 && typeof matches[0].optionId === 'string' ? { optionId: matches[0].optionId, name: matches[0].name, fieldName: matches[0].field.name } : undefined;
}
