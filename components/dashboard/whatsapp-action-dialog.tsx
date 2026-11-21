"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatWhatsAppUrl } from "@/lib/utils";

export type WhatsAppTemplate = "quotation" | "invoice" | "follow-up" | "payment-receipt";

const TEMPLATE_OPTIONS: { value: WhatsAppTemplate; label: string }[] = [
  { value: "quotation", label: "Quotation / Proposal" },
  { value: "invoice", label: "Invoice Dispatch" },
  { value: "follow-up", label: "Follow-Up" },
  { value: "payment-receipt", label: "Payment Receipt" },
];

function isWhatsAppTemplate(value: string): value is WhatsAppTemplate {
  return TEMPLATE_OPTIONS.some((option) => option.value === value);
}

export function WhatsAppActionDialog({
  phone,
  contact,
  company,
  link,
  invoiceNumber,
  amount,
  balance,
  defaultTemplate = "follow-up",
  trigger,
}: {
  phone: string;
  contact: string;
  company: string;
  link?: string;
  invoiceNumber?: string;
  amount?: string;
  balance?: string;
  defaultTemplate?: WhatsAppTemplate;
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = React.useState(false);
  const [template, setTemplate] = React.useState<WhatsAppTemplate>(defaultTemplate);
  const [message, setMessage] = React.useState("");
  const recipient = contact.trim() || "there";
  const companyName = company.trim() || "your company";
  const normalizedPhone = phone.replace(/\D/g, "");
  const hasValidPhone = normalizedPhone.length >= 6;

  const buildMessage = React.useCallback((selected: WhatsAppTemplate) => {
    switch (selected) {
      case "quotation":
        return `Hello ${recipient}, here is the proposal for ${companyName}: ${link || "[proposal link]"}.`;
      case "invoice":
        return `Hello ${recipient}, invoice ${invoiceNumber || "[invoice number]"} for ${amount || "[amount]"} from Lakeside Technologies is ready. View invoice: ${link || "[invoice link]"}.`;
      case "payment-receipt":
        return `Payment received! We have recorded ${amount || "[amount]"} for ${companyName}. Remaining balance: ${balance || "[balance]"}.`;
      case "follow-up":
        return `Hello ${recipient}, checking in on ${companyName}'s project review. Let me know when you are free for a brief call.`;
    }
  }, [amount, balance, companyName, invoiceNumber, link, recipient]);

  React.useEffect(() => {
    if (open) setMessage(buildMessage(template));
  }, [buildMessage, open, template]);

  function handleSend() {
    if (!hasValidPhone || !message.trim()) return;
    window.open(formatWhatsAppUrl(phone, message.trim()), "_blank", "noopener,noreferrer");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send a WhatsApp message</DialogTitle>
          <DialogDescription>
            Choose a sales template and personalize the message before opening WhatsApp.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="whatsapp-template">Message template</Label>
            <Select
              value={template}
              onValueChange={(value) => {
                if (isWhatsAppTemplate(value)) setTemplate(value);
              }}
            >
              <SelectTrigger id="whatsapp-template">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="whatsapp-message">Message</Label>
            <Textarea
              id="whatsapp-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={6}
              maxLength={2000}
              aria-describedby="whatsapp-recipient"
            />
            <p id="whatsapp-recipient" className="text-xs text-muted-foreground">
              To {phone || "no phone number"}
            </p>
            {!hasValidPhone ? (
              <p role="alert" className="text-xs text-destructive">
                Add a valid phone number to this opportunity before sending a WhatsApp message.
              </p>
            ) : null}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSend} disabled={!hasValidPhone || !message.trim()}>
            Open WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
