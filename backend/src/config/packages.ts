export interface PackageDetails {
  name: string;
  price: number;
  credits: number;
}

export const PACKAGES: Record<string, PackageDetails> = {
  starter: {
    name: "Starter Pack",
    price: 399,
    credits: 5,
  },
  pro: {
    name: "Pro Pack",
    price: 799,
    credits: 15,
  },
};
