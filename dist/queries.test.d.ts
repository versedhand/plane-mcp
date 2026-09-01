/**
 * Integration tests for plane-mcp queries.
 * Requires live connections to both Plane instances and LifeDB.
 *
 * Run: PLANE_PERSONAL_DB_HOST=localhost PLANE_PERSONAL_DB_PORT=15432 \
 *      PLANE_PERSONAL_DB_PASSWORD=$PLANE_DB_PASSWORD PLANE_PERSONAL_WORKSPACE_SLUG=personal \
 *      PLANE_NTS_DB_HOST=localhost PLANE_NTS_DB_PORT=15433 \
 *      PLANE_NTS_DB_PASSWORD=$PLANE_DB_PASSWORD PLANE_NTS_WORKSPACE_SLUG=nts \
 *      LIFEDB_URL=postgresql://postgres@localhost:5432/lifedb \
 *      npx vitest run
 */
export {};
