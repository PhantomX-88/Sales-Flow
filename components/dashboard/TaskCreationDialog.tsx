"use client";

import * as React from "react";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, Button
} from "@/components/ui/dialog";
import { usePipeline } from "@/components/dashboard/pipeline-provider";
import { useAuth } from "@/components/auth/auth-provider";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectItem } from "@/components/ui/select";
import { lucideClock, lucideUser, lucideCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function TaskCreationDialog() {
  const { createTask, isLoading } = usePipeline();
  const { membershipRole, userId, organization } = useAuth();
  const isOwner = membershipRole === "owner";
  
  const [taskTitle, setTaskTitle] = React.useState("");
  const [assignedTo, setAssignedTo] = React.useState(userId ?? "");
  const [dueDate, setDueDate] = React.useState<string | undefined>(undefined);
  const [open, setOpen] = React.useState(false);
  
  // Fetch organization members for assignment
  const { data: members = [] } = React.useMemo(() => {
    // TODO: Fetch from organization_members table
    return [];
  }, [organizationId]);
  
  const handleSubmit = async () => {
    if (!taskTitle.trim()) return;
    const success = await createTask(taskTitle, assignedTo, dueDate);
    if (success) setOpen(false);
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-6">
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
          <DialogDescription>Assign a task to a team member</DialogDescription>
        </DialogHeader>
        
        <form onSubmit={e => { e.preventDefault(); handleSubmit(); }}>
          <div className="grid grid-cols-1 gap-4 mb-4">
            <label className="text-sm font-medium">Task Title</label>
            <Input
              value={taskTitle}
              onValueChange={setTaskTitle}
              placeholder="What needs to be done?"
              required
            />
          </div>
          
          {isOwner && (
            <div className="grid grid-cols-1 gap-4 mb-4">
              <label className="text-sm font-medium">Assigned To</label>
              <Select>
                <SelectTrigger>
                  <SelectValue defaultValue={assignedTo} />
                </SelectTrigger>
                <SelectContent>
                  {members.map((member) => (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      {member.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          {isOwner && (
            <div className="grid grid-cols-1 gap-4 mb-4">
              <label className="text-sm font-medium">Due Date</label>
              <Input
                type="date"
                value={dueDate ?? ""}
                onValueChange={(e) => setDueDate(e.target.value || undefined)}
                placeholder="Select due date"
              />
            </div>
          )}
          
          <div className="mb-4">
            <label className="text-sm font-medium">Related Opportunity (optional)</label>
            <p className="text-sm text-muted-foreground">Link to opportunity if applicable</p>
          </div>
          
          <DialogFooter className="justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={!taskTitle.trim() || isLoading}>
              Create Task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}