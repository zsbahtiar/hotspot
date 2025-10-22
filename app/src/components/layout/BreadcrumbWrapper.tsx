import Breadcrumb from "@/components/layout/Breadcrumb";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbWrapperProps {
  items: BreadcrumbItem[];
}

export default function BreadcrumbWrapper({ items }: BreadcrumbWrapperProps) {
  return <Breadcrumb items={items} />;
}
