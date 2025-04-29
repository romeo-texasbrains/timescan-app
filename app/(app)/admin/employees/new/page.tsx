import AddEmployeeForm from "@/components/admin/AddEmployeeForm";

export default function AddEmployeePage() {
  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold mb-6">Add New Employee</h1>
      <div className="max-w-md mx-auto">
         <AddEmployeeForm />
      </div>
    </div>
  );
}

// Removed the extraneous <FormField> blocks from here