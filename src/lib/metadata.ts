const store = new Map<string, { name: string; symbol: string; description: string; imageBase64: string; imageContentType: string }>();

export function storeMetadata(
  id: string,
  data: { name: string; symbol: string; description: string; imageBase64: string; imageContentType: string },
) {
  store.set(id, data);
}

export function getMetadata(id: string) {
  return store.get(id) ?? null;
}

export function buildMetadataJson(data: { name: string; symbol: string; description: string; imageUrl: string }) {
  return {
    name: data.name,
    symbol: data.symbol,
    description: data.description,
    image: data.imageUrl,
    seller_fee_basis_points: 0,
    external_url: "",
    attributes: [] as { trait_type: string; value: string | number }[],
    properties: {
      files: [{ uri: data.imageUrl, type: "" }],
      category: "token",
    },
  };
}