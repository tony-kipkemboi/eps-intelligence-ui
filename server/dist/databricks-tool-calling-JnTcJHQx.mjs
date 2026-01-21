import z$1 from "zod";

//#region ../packages/ai-sdk-providers/src/databricks-provider/databricks-tool-calling.ts
const DATABRICKS_TOOL_CALL_ID = "databricks-tool-call";
/**
* The AI-SDK requires that tools used by the model are defined ahead of time.
*
* Since tool calls can be orchestrated by Databricks' agents we don't know the name, input, or output schemas
* of the tools until the model is called.
*
* In the DatabricksProvider we transform all tool calls to fit this definition, and keep the
* original name as part of the metadata. This allows us to parse any tool orchestrated by Databricks' agents,
* while still being able to render the tool call and result in the UI, and pass it back to the model with the correct name.
*/
const DATABRICKS_TOOL_DEFINITION = {
	name: DATABRICKS_TOOL_CALL_ID,
	description: "Databricks tool call",
	inputSchema: z$1.any(),
	outputSchema: z$1.any()
};

//#endregion
export { DATABRICKS_TOOL_DEFINITION as n, DATABRICKS_TOOL_CALL_ID as t };